module.exports = {
  "*.{ts}": ["yarn lint --fix"],
  "*.{ts,md,yml,json}": ["prettier --write"],
}
