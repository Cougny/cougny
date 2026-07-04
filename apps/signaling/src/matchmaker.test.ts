import { describe } from 'vitest';
import { InMemoryMatchmaker } from './matchmaker.js';
import { describeMatchmakerContract } from './matchmaker-contract.js';

describe('InMemoryMatchmaker', () => {
  describeMatchmakerContract((maxWaiting) => new InMemoryMatchmaker(maxWaiting));
});
