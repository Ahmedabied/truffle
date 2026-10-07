# Input: jq -s, one or more Claude Code JSONL files.
# Required --argjson values:
#   sessions: array of exact sessionId strings, or [] for every supplied session.
#   first, last: inclusive 1-based JSON-record positions across supplied files.
# Drops non-conversation records and unnecessary top-level/message metadata.
# This is structural selection, NOT redaction. Content remains sensitive.
if ($sessions | type) != "array" then error("sessions must be an array")
elif (($first | type) != "number") or (($last | type) != "number") then
  error("first and last must be numbers")
elif ($first < 1) or ($last < $first) or ($first != ($first | floor)) or ($last != ($last | floor)) then
  error("first and last must be ordered positive integers")
else
  to_entries[]
  | select((.key + 1) >= $first and (.key + 1) <= $last)
  | .value
  | select(.type == "user" or .type == "assistant")
  | . as $record
  | select(($sessions | length) == 0 or ($sessions | index($record.sessionId)) != null)
  | select((.message | type) == "object")
  | {type, sessionId, timestamp, message: {role: .message.role, content: .message.content}}
end
