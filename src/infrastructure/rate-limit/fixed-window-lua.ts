/** Atomic fixed-window counter (first hit starts TTL). Compatible with Redis/Upstash. */
export const FIXED_WINDOW_RATE_LIMIT_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
if count > tonumber(ARGV[1]) then
  local ttl = redis.call('PTTL', KEYS[1])
  return {0, ttl}
end
return {1, 0}
`;
