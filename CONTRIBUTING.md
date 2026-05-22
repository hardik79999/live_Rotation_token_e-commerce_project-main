# Contributing to ShopHub

First off, thank you for taking the time to contribute! To maintain code quality, security, and scalability, we adhere to strict standards across both the frontend and backend.

---

## 🌿 Git Workflow & Branch Model

We use a Git Flow-inspired branching model. All development should take place on branch branches branched off `main`.

### Branch Naming Conventions
- **Features**: `feature/short-description` (e.g., `feature/payment-integration`)
- **Bug Fixes**: `bugfix/issue-description` (e.g., `bugfix/session-timeout-fix`)
- **Hotfixes**: `hotfix/urgent-prod-fix` (e.g., `hotfix/cors-credentials-bypass`)

### Commit Message Formatting
We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
```
<type>(<scope>): <description>

[optional body]
```
#### Types:
- `feat`: A new user-facing feature.
- `fix`: A bug fix.
- `docs`: Documentation updates.
- `style`: Formatting, missing semi-colons, white-space modifications (no functional code changes).
- `refactor`: Refactoring production code without behavior changes.
- `perf`: Code changes that improve performance.
- `test`: Adding missing tests or correcting existing tests.

---

## 💻 Coding Standards

### Backend (Python/Flask)
- **PEP 8**: Code must strictly conform to PEP 8 standards. Use `flake8` or `black` for style checking.
- **Type Annotations**: Provide explicit type hints for all function arguments and return types.
- **Error Handling**: Never use bare `except:` blocks; capture specific exceptions and log them with context using `app.logger`.

### Frontend (React/TypeScript)
- **TypeScript Strict Mode**: No implicit `any` variables. Ensure compile-time types are clean.
- **React Hooks**: Follow the rules of hooks. Always cleanup timers, listeners, and subscriptions inside `useEffect` return blocks.
- **Tailwind Native utility styles**: Do not combine ad-hoc styles in components. Standardize spacing and color classes based on the Tailwind theme system.

---

## 🚀 Pull Request Process

1. Fork the repo and create your branch from `main`.
2. Ensure linting and formatting pass locally.
3. Test your features thoroughly (including mobile/responsive layouts if changing UI).
4. Update the `README.md` if your change adds new configuration parameters or changes the deployment structure.
5. Open a Pull Request detailing the changes, the motivations, and attaching screenshots for visual adjustments.
