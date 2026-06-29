# @recurrsive/opportunities

Opportunity lifecycle management with SARIF export, roadmap generation, and composite scoring.

## Installation

```bash
pnpm add @recurrsive/opportunities
```

## Usage

```typescript
import { OpportunityManager } from '@recurrsive/opportunities';

const manager = new OpportunityManager();
manager.add(opportunity);
const topN = manager.getTopN(10);
await manager.save('.recurrsive/opportunities.json');
const sarif = manager.exportSARIF();
const roadmap = manager.generateRoadmap();
```

## Features

| Feature | Description |
|---------|-------------|
| CRUD | Create, read, update, delete with status transitions |
| Ranking | Composite scoring with Union-Find dependency clustering |
| SARIF Export | SARIF v2.1.0 for CI/CD integration |
| Markdown Reports | Executive summaries with evidence |
| Roadmap | 3-phase grouping: Quick Wins → Strategic → Long-term |
| Persistence | JSON save/load with import validation |

## License

[Apache-2.0](../../LICENSE)
