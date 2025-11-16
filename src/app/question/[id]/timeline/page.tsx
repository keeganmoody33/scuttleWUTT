import { db } from '@/db';
import { getSnapshotsForQuestion, compareSnapshots } from '@/services/snapshots';
import { notFound } from 'next/navigation';

interface TimelinePageProps {
  params: {
    id: string;
  };
}

export default async function TimelinePage({ params }: TimelinePageProps) {
  const { id: questionId } = params;

  // Get the question
  const question = await db.query.questions.findFirst({
    where: (questions, { eq }) => eq(questions.id, questionId),
  });

  if (!question) {
    notFound();
  }

  // Get all snapshots for this question
  const snapshots = await getSnapshotsForQuestion(questionId);

  if (snapshots.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Timeline</h1>
          <p className="text-gray-600 mb-8">"{question.question}"</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800">No snapshots available yet. Check back after the first update.</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate diffs between consecutive snapshots
  const snapshotsWithDiffs = snapshots.map((snapshot, index) => {
    const previousSnapshot = snapshots[index + 1]; // Next in array (older)
    const diff = previousSnapshot ? compareSnapshots(previousSnapshot, snapshot) : null;

    return {
      snapshot,
      diff,
      isFirst: index === 0,
      isInitial: index === snapshots.length - 1,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Answer Timeline</h1>
          <p className="text-lg text-gray-600 mb-1">"{question.question}"</p>
          <p className="text-sm text-gray-500">{snapshots.length} snapshot{snapshots.length > 1 ? 's' : ''} recorded</p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Snapshots */}
          <div className="space-y-8">
            {snapshotsWithDiffs.map(({ snapshot, diff, isFirst, isInitial }) => (
              <div key={snapshot.id} className="relative pl-20">
                {/* Timeline dot */}
                <div
                  className={`absolute left-6 w-5 h-5 rounded-full border-4 border-white ${
                    isFirst ? 'bg-green-500' : isInitial ? 'bg-blue-500' : 'bg-gray-400'
                  }`}
                  style={{ top: '24px' }}
                />

                {/* Snapshot card */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  {/* Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {isInitial ? 'Initial Answer' : isFirst ? 'Latest Update' : 'Update'}
                          </h3>
                          {isFirst && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(snapshot.snapshotDate).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">{snapshot.modelUsed}</span>
                      </div>
                    </div>
                  </div>

                  {/* Changes summary (if not initial) */}
                  {diff && !isInitial && (
                    <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                      <h4 className="text-sm font-semibold text-blue-900 mb-3">What Changed</h4>

                      {diff.added.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-green-700 mb-1">NEW ENTRIES</p>
                          {diff.added.map((tool) => (
                            <div key={tool.name} className="text-sm text-green-800 ml-3">
                              + {tool.name}
                            </div>
                          ))}
                        </div>
                      )}

                      {diff.removed.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-red-700 mb-1">REMOVED</p>
                          {diff.removed.map((tool) => (
                            <div key={tool.name} className="text-sm text-red-800 ml-3 line-through opacity-70">
                              - {tool.name}
                            </div>
                          ))}
                        </div>
                      )}

                      {diff.moved.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-blue-700 mb-1">RANKING CHANGES</p>
                          {diff.moved.map(({ tool, oldRank, newRank, direction }) => (
                            <div key={tool.name} className="text-sm text-blue-800 ml-3">
                              {direction === 'up' ? '↑' : '↓'} {tool.name}: #{oldRank} → #{newRank}
                            </div>
                          ))}
                        </div>
                      )}

                      {diff.added.length === 0 && diff.removed.length === 0 && diff.moved.length === 0 && (
                        <p className="text-sm text-gray-600 italic">No significant changes</p>
                      )}
                    </div>
                  )}

                  {/* Tools list */}
                  <div className="px-6 py-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      {snapshot.answer.tools.length} Tool{snapshot.answer.tools.length > 1 ? 's' : ''}
                    </h4>
                    <div className="space-y-4">
                      {snapshot.answer.tools.map((tool, index) => (
                        <div key={index} className="border-l-4 border-gray-300 pl-4">
                          <div className="flex items-start justify-between mb-1">
                            <h5 className="font-semibold text-gray-900">
                              #{index + 1} {tool.name}
                            </h5>
                            <a
                              href={tool.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Visit →
                            </a>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{tool.description}</p>
                          <div className="text-xs text-gray-600 space-y-1">
                            <p><span className="font-medium">Maker:</span> {tool.maker}</p>
                            <p><span className="font-medium">Use Case:</span> {tool.useCase}</p>
                            <p><span className="font-medium text-green-600">Proof:</span> {tool.proof}</p>
                            <p><span className="font-medium text-red-600">Downside:</span> {tool.downside}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Back link */}
        <div className="mt-12 text-center">
          <a
            href="/ask"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Ask
          </a>
        </div>
      </div>
    </div>
  );
}
