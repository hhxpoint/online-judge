"""
Online Judge Server
Receives code submissions, compiles and executes them,
compares output with expected results, and updates the database.
"""

import os
import subprocess
import tempfile
import json
import resource
import signal
from pathlib import Path
from flask import Flask, request, jsonify
from supabase import create_client, Client

app = Flask(__name__)

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Timeouts
COMPILE_TIMEOUT = 30  # seconds
RUN_TIMEOUT = 10  # seconds


def update_submission(submission_id: int, data: dict):
    """Update submission record in database."""
    try:
        supabase.table("submissions").update(data).eq("id", submission_id).execute()
    except Exception as e:
        print(f"Error updating submission {submission_id}: {e}")


def compile_cpp(code: str, work_dir: str) -> tuple[bool, str]:
    """Compile C++ code and return (success, error_message)."""
    source_file = os.path.join(work_dir, "main.cpp")
    executable = os.path.join(work_dir, "main")

    with open(source_file, "w") as f:
        f.write(code)

    try:
        result = subprocess.run(
            ["g++", "-std=c++17", "-O2", "-o", executable, source_file],
            capture_output=True,
            text=True,
            timeout=COMPILE_TIMEOUT,
        )

        if result.returncode != 0:
            return False, result.stderr[:1000]
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "Compilation timeout"
    except Exception as e:
        return False, str(e)


def run_code(
    language: str,
    work_dir: str,
    input_data: str,
    time_limit: int,  # ms
    memory_limit: int,  # MB
) -> tuple[str, str, int, int, str]:
    """
    Run code and return (output, error, time_ms, memory_kb, status).
    Status: 'ok', 'tle', 'mle', 're'
    """
    if language == "cpp":
        cmd = [os.path.join(work_dir, "main")]
    elif language == "python":
        cmd = ["python3", os.path.join(work_dir, "main.py")]
    else:
        return "", "Unsupported language", 0, 0, "re"

    time_limit_sec = time_limit / 1000.0
    memory_limit_kb = memory_limit * 1024

    def set_limits():
        """Set resource limits for child process."""
        # CPU time limit
        resource.setrlimit(resource.RLIMIT_CPU, (int(time_limit_sec) + 1, int(time_limit_sec) + 2))
        # Memory limit
        resource.setrlimit(resource.RLIMIT_AS, (memory_limit_kb * 1024 * 2, memory_limit_kb * 1024 * 2))
        # File size limit (10MB)
        resource.setrlimit(resource.RLIMIT_FSIZE, (10 * 1024 * 1024, 10 * 1024 * 1024))
        # Number of processes limit
        resource.setrlimit(resource.RLIMIT_NPROC, (1, 1))

    try:
        import time
        start_time = time.time()

        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=set_limits,
            cwd=work_dir,
        )

        try:
            stdout, stderr = process.communicate(input=input_data, timeout=time_limit_sec + 1)
            elapsed = int((time.time() - start_time) * 1000)

            if process.returncode != 0:
                return stdout[:10000], stderr[:1000], elapsed, 0, "re"

            # Estimate memory usage (rough approximation)
            try:
                with open(f"/proc/{process.pid}/status") as f:
                    for line in f:
                        if line.startswith("VmPeak:"):
                            memory_kb = int(line.split()[1])
                            break
            except:
                memory_kb = 0

            return stdout[:10000], "", elapsed, memory_kb, "ok"

        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            return "", "Time limit exceeded", time_limit, 0, "tle"

    except MemoryError:
        return "", "Memory limit exceeded", 0, memory_limit_kb, "mle"
    except Exception as e:
        return "", str(e)[:1000], 0, 0, "re"


def judge_single_case(
    language: str,
    work_dir: str,
    input_data: str,
    expected_output: str,
    time_limit: int,
    memory_limit: int,
) -> dict:
    """Judge a single test case."""
    output, error, exec_time, exec_memory, run_status = run_code(
        language, work_dir, input_data, time_limit, memory_limit
    )

    if run_status == "tle":
        return {"status": "time_limit_exceeded", "time": exec_time, "memory": exec_memory}
    if run_status == "mle":
        return {"status": "memory_limit_exceeded", "time": exec_time, "memory": exec_memory}
    if run_status == "re":
        return {"status": "runtime_error", "error": error, "time": exec_time, "memory": exec_memory}

    # Compare output
    actual = output.strip()
    expected = expected_output.strip()

    if actual == expected:
        return {"status": "accepted", "time": exec_time, "memory": exec_memory}
    else:
        return {
            "status": "wrong_answer",
            "input": input_data[:500],
            "expected": expected[:500],
            "actual": actual[:500],
            "time": exec_time,
            "memory": exec_memory,
        }


@app.route("/judge", methods=["POST"])
def judge():
    """Main judge endpoint."""
    try:
        data = request.json
        submission_id = data.get("submission_id")
        code = data.get("code")
        language = data.get("language")
        test_input = data.get("test_input", "")
        test_output = data.get("test_output", "")
        time_limit = data.get("time_limit", 1000)
        memory_limit = data.get("memory_limit", 256)

        if not all([submission_id, code, language]):
            return jsonify({"error": "Missing required fields"}), 400

        # Update status to judging
        update_submission(submission_id, {"status": "judging"})

        with tempfile.TemporaryDirectory() as work_dir:
            # Write source code
            if language == "cpp":
                success, error_msg = compile_cpp(code, work_dir)
                if not success:
                    update_submission(submission_id, {
                        "status": "compile_error",
                        "error_message": error_msg,
                    })
                    return jsonify({"status": "compile_error", "error": error_msg})
            elif language == "python":
                with open(os.path.join(work_dir, "main.py"), "w") as f:
                    f.write(code)
            else:
                return jsonify({"error": "Unsupported language"}), 400

            # Parse test cases
            input_cases = test_input.strip().split("\n\n")
            output_cases = test_output.strip().split("\n\n")

            if len(input_cases) != len(output_cases):
                return jsonify({"error": "Test case mismatch"}), 400

            max_time = 0
            max_memory = 0

            # Judge each test case
            for i, (inp, exp) in enumerate(zip(input_cases, output_cases)):
                result = judge_single_case(language, work_dir, inp, exp, time_limit, memory_limit)

                max_time = max(max_time, result.get("time", 0))
                max_memory = max(max_memory, result.get("memory", 0))

                if result["status"] != "accepted":
                    update_submission(submission_id, {
                        "status": result["status"],
                        "execution_time": result.get("time"),
                        "execution_memory": result.get("memory"),
                        "error_message": result.get("error", f"Failed on test case {i + 1}"),
                    })
                    return jsonify(result)

            # All test cases passed
            update_submission(submission_id, {
                "status": "accepted",
                "execution_time": max_time,
                "execution_memory": max_memory,
            })

            return jsonify({
                "status": "accepted",
                "time": max_time,
                "memory": max_memory,
            })

    except Exception as e:
        print(f"Judge error: {e}")
        if submission_id:
            update_submission(submission_id, {
                "status": "runtime_error",
                "error_message": str(e)[:1000],
            })
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port)
