import logging
import sys
from pathlib import Path

# Test logging configuration
log_dir = Path(__file__).parent
log_file = log_dir / "test.log"

print(f"Log file path: {log_file}")
print(f"Log directory exists: {log_dir.exists()}")
print(f"Log file exists before: {log_file.exists()}")

# Remove existing handlers
for handler in logging.root.handlers[:]:
    logging.root.removeHandler(handler)

# Create formatter
formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# File handler
try:
    file_handler = logging.FileHandler(log_file, encoding="utf-8", mode="a")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    print("✓ File handler created successfully")
except Exception as e:
    print(f"✗ Error creating file handler: {e}")

# Stream handler
stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setLevel(logging.INFO)
stream_handler.setFormatter(formatter)
print("✓ Stream handler created successfully")

# Configure root logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)
root_logger.addHandler(file_handler)
root_logger.addHandler(stream_handler)

logger = logging.getLogger(__name__)

# Test logging
print("\n--- Testing logging ---\n")
logger.info("This is an INFO message")
logger.debug("This is a DEBUG message")
logger.warning("This is a WARNING message")
logger.error("This is an ERROR message")

# Force flush
for handler in root_logger.handlers:
    handler.flush()

print(f"\nLog file exists after: {log_file.exists()}")
if log_file.exists():
    with open(log_file, "r") as f:
        content = f.read()
        print(f"Log file size: {len(content)} bytes")
        print("\nLog file contents:")
        print(content)
