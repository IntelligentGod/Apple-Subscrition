Apple's public root certificates (DER `.cer`), from https://www.apple.com/certificateauthority/

- `AppleRootCA-G3.cer` — the root that App Store transactions and notifications are signed under
- `AppleRootCA-G2.cer`

The server uses them to check that a transaction or notification really comes from Apple.
They are public, so it is fine to keep them in git.
