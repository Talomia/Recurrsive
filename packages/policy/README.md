# @recurrsive/policy

Policy evaluation engine with recursive descent expression parser. Enforces governance rules on opportunities without using `eval()`.

## Installation

```bash
pnpm add @recurrsive/policy
```

## Usage

```typescript
import { PolicyEngine, getBuiltinPolicySet } from '@recurrsive/policy';

const engine = new PolicyEngine();
for (const policySet of getBuiltinPolicySet()) {
  engine.addPolicySet(policySet);
}

const result = engine.evaluate(opportunity);
if (!result.passes) {
  console.log('Violations:', result.violations);
}
```

## Expression Language

Supports: `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`, `!`, `in`, `contains`, `startsWith`, `endsWith`

Example: `severity == "critical" && confidence > 0.8`

## Built-in Policy Sets

| Policy Set | Rules | Description |
|------------|-------|-------------|
| Security Baseline | 3 | Block critical security issues |
| Change Management | 3 | Require approval for breaking changes |
| Cost Governance | 3 | Flag high-cost opportunities |
| Compliance | 3 | Enforce regulatory requirements |
| Quality Gates | 4 | Minimum quality thresholds |

## Development

```bash
# Run tests
pnpm test --filter @recurrsive/policy

# Build
pnpm build --filter @recurrsive/policy

# Lint
pnpm lint --filter @recurrsive/policy
```

## License

[Apache-2.0](../../LICENSE)
