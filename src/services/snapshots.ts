import { db, answerSnapshots } from '@/db';
import { generateId } from '@/lib/utils';
import { eq, desc } from 'drizzle-orm';
import type { QuestionAnswer } from './question-answering';

export interface Tool {
  name: string;
  description: string;
  maker: string;
  useCase: string;
  proof: string;
  downside: string;
  link: string;
}

export interface SnapshotDiff {
  added: Tool[];
  removed: Tool[];
  moved: Array<{
    tool: Tool;
    oldRank: number;
    newRank: number;
    direction: 'up' | 'down' | 'same';
  }>;
  unchanged: Tool[];
}

/**
 * Create a new snapshot for a question
 */
export async function createSnapshot(
  questionId: string,
  question: string,
  answer: QuestionAnswer,
  modelUsed: string = 'claude-sonnet-4-5'
): Promise<string> {
  const snapshotId = generateId('snap');

  await db.insert(answerSnapshots).values({
    id: snapshotId,
    questionId,
    question,
    answer,
    modelUsed,
    snapshotDate: new Date(),
    createdAt: new Date(),
  });

  console.log(`✓ Created snapshot ${snapshotId} for question ${questionId}`);

  return snapshotId;
}

/**
 * Get all snapshots for a question
 */
export async function getSnapshotsForQuestion(questionId: string) {
  return db.query.answerSnapshots.findMany({
    where: (snapshots, { eq }) => eq(snapshots.questionId, questionId),
    orderBy: (snapshots, { desc }) => [desc(snapshots.snapshotDate)],
  });
}

/**
 * Get the latest snapshot for a question
 */
export async function getLatestSnapshot(questionId: string) {
  const snapshots = await db.query.answerSnapshots.findMany({
    where: (snapshots, { eq }) => eq(snapshots.questionId, questionId),
    orderBy: (snapshots, { desc }) => [desc(snapshots.snapshotDate)],
    limit: 1,
  });

  return snapshots[0] || null;
}

/**
 * Compare two snapshots and return the diff
 */
export function compareSnapshots(
  oldSnapshot: { answer: QuestionAnswer },
  newSnapshot: { answer: QuestionAnswer }
): SnapshotDiff {
  const oldTools = oldSnapshot.answer.tools;
  const newTools = newSnapshot.answer.tools;

  // Find added tools (in new but not in old)
  const added = newTools.filter(
    (newTool) => !oldTools.some((oldTool) => oldTool.name === newTool.name)
  );

  // Find removed tools (in old but not in new)
  const removed = oldTools.filter(
    (oldTool) => !newTools.some((newTool) => newTool.name === oldTool.name)
  );

  // Find moved/unchanged tools
  const moved: SnapshotDiff['moved'] = [];
  const unchanged: Tool[] = [];

  newTools.forEach((newTool, newIndex) => {
    const oldIndex = oldTools.findIndex((oldTool) => oldTool.name === newTool.name);

    if (oldIndex !== -1) {
      // Tool exists in both snapshots
      const oldRank = oldIndex + 1;
      const newRank = newIndex + 1;

      if (oldRank !== newRank) {
        // Tool moved
        moved.push({
          tool: newTool,
          oldRank,
          newRank,
          direction: newRank < oldRank ? 'up' : 'down',
        });
      } else {
        // Tool stayed in same position
        unchanged.push(newTool);
      }
    }
  });

  return {
    added,
    removed,
    moved,
    unchanged,
  };
}

/**
 * Format diff as human-readable text
 */
export function formatDiffAsText(diff: SnapshotDiff): string {
  const lines: string[] = [];

  if (diff.added.length > 0) {
    lines.push('NEW ENTRIES:');
    diff.added.forEach((tool) => {
      lines.push(`  + ${tool.name} - ${tool.description}`);
    });
    lines.push('');
  }

  if (diff.removed.length > 0) {
    lines.push('REMOVED:');
    diff.removed.forEach((tool) => {
      lines.push(`  - ${tool.name}`);
    });
    lines.push('');
  }

  if (diff.moved.length > 0) {
    lines.push('RANKING CHANGES:');
    diff.moved.forEach(({ tool, oldRank, newRank, direction }) => {
      const arrow = direction === 'up' ? '↑' : '↓';
      lines.push(`  ${arrow} ${tool.name}: #${oldRank} → #${newRank}`);
    });
    lines.push('');
  }

  if (diff.unchanged.length > 0) {
    lines.push('UNCHANGED:');
    diff.unchanged.forEach((tool) => {
      lines.push(`  = ${tool.name}`);
    });
  }

  return lines.join('\n');
}

/**
 * Format diff as HTML for email
 */
export function formatDiffAsHTML(diff: SnapshotDiff): string {
  const sections: string[] = [];

  if (diff.added.length > 0) {
    sections.push(`
      <div style="margin-bottom: 16px;">
        <h3 style="color: #10b981; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">🆕 NEW ENTRIES</h3>
        ${diff.added
          .map(
            (tool) => `
          <div style="padding: 8px 0; border-left: 3px solid #10b981; padding-left: 12px; margin-bottom: 8px;">
            <strong>${tool.name}</strong> - ${tool.description}
          </div>
        `
          )
          .join('')}
      </div>
    `);
  }

  if (diff.removed.length > 0) {
    sections.push(`
      <div style="margin-bottom: 16px;">
        <h3 style="color: #ef4444; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">❌ REMOVED</h3>
        ${diff.removed
          .map(
            (tool) => `
          <div style="padding: 8px 0; border-left: 3px solid #ef4444; padding-left: 12px; margin-bottom: 8px; opacity: 0.7;">
            ${tool.name}
          </div>
        `
          )
          .join('')}
      </div>
    `);
  }

  if (diff.moved.length > 0) {
    sections.push(`
      <div style="margin-bottom: 16px;">
        <h3 style="color: #3b82f6; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">📊 RANKING CHANGES</h3>
        ${diff.moved
          .map(
            ({ tool, oldRank, newRank, direction }) => `
          <div style="padding: 8px 0; border-left: 3px solid #3b82f6; padding-left: 12px; margin-bottom: 8px;">
            <strong>${tool.name}</strong>:
            <span style="color: ${direction === 'up' ? '#10b981' : '#ef4444'};">
              ${direction === 'up' ? '↑' : '↓'} #${oldRank} → #${newRank}
            </span>
          </div>
        `
          )
          .join('')}
      </div>
    `);
  }

  return sections.join('');
}

/**
 * Check if there are significant changes between snapshots
 */
export function hasSignificantChanges(diff: SnapshotDiff): boolean {
  // Significant if:
  // - Any tools added or removed
  // - Any tools moved more than 1 position
  if (diff.added.length > 0 || diff.removed.length > 0) {
    return true;
  }

  const significantMoves = diff.moved.filter(
    ({ oldRank, newRank }) => Math.abs(oldRank - newRank) > 1
  );

  return significantMoves.length > 0;
}
