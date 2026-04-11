# API E2E HTTP Tests

Run these files with the JetBrains HTTP Client from top to bottom.

1. `00-auth.http` sets `adminAccessToken`, `adminRefreshToken`, `userAccessToken`, `userRefreshToken`, and `runId`.
2. The remaining files are grouped by API area and reuse those global variables.

Most write tests create `e2e-*` data with a timestamp suffix and then update/delete that same data. The password test changes the `user` account password to `TempPass123!` and immediately changes it back to `123456`.

Each request sets a distinct `X-Forwarded-For` test IP so batch runs do not trip the local security guard's minimum request interval or login throttling.
