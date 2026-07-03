# @recurrsive/policy

Policy evaluation engine with recursive descent expression parser. Enforces governance rules on opportunities without using `eval()`.

## Installation

```bash
pnpm add @recurrsive/policy
```

## Usage

```typescript
import { PolicyEngine, BUILTIN_POLICIES, getBuiltinPolicySet } from '@recurrsive/policy';

const engine = new PolicyEngine();

// Load all built-in policies
for (const policySet of BUILTIN_POLICIES) {
  engine.addPolicySet(policySet);
}

// Or load a single policy set by id
const security = getBuiltinPolicySet('builtin:security-baseline');
if (security) engine.addPolicySet(security);

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

## API

### Built-in Policy Set Constants

| Constant | Description |
|----------|-------------|
| `securityBaseline` | Minimum security standards |
| `changeManagement` | Change review requirements |
| `costGovernance` | Resource cost limits |
| `compliance` | Regulatory compliance checks |
| `qualityGates` | Code quality gates |
| `BUILTIN_POLICIES` | Array of all built-in policy sets |

### Evaluation

| Export | Description |
|--------|-------------|
| `getBuiltinPolicySet(id)` | Look up a single built-in policy set by id |
| `evaluateCondition(condition, context)` | Evaluate a single policy condition |

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
