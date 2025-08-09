## Contributing guidelines

Please be aware of the [Code of conduct](CODE_OF_CONDUCT.md).

### You have a question or idea

Your feedback is highly appreciated in [Discussions section](https://github.com/RobinTail/express-zod-api/discussions).

### You found a bug

Please [create a bug issue](https://github.com/RobinTail/express-zod-api/issues/new/choose).

### You found a vulnerability or other security issue

Please refer to [Security policy](SECURITY.md).

### You wanna make it yourself

Which is highly appreciated as well. Consider these steps:

- Fork the repo,
- Create a new branch in your fork of the repo (don't change `master`),
- Install the dependencies using `pnpm i`,
- Install the pre-commit hooks using `pnpm install_hooks`,
- Make changes,
- Run `pnpm build` (needed for some tests),
- Run the tests using `pnpm test`,
- Commit everything,
- Push your branch into your fork,
- Create a PR between the forks:
  - Make sure to allow edits by maintainer,
  - Describe the changes (why those changes are required?):
    - If you're fixing something, please create the bug issue first and make a reference "Fixes #...";
    - If you're improving something, please make sure your solution is generic.
- If I didn't notice your PR in a week, please mention me in a comment to your PR.
