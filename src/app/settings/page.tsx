import { Header } from '@/components/Header';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-gray-600 mb-8">
            Customize your product discovery experience
          </p>

          <div className="space-y-8">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Email Address
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Interests
              </label>
              <p className="text-sm text-gray-600 mb-3">
                What topics are you interested in?
              </p>
              <div className="flex flex-wrap gap-2">
                {['AI', 'Productivity', 'Developer Tools', 'Design', 'Marketing', 'Analytics', 'SaaS', 'Mobile'].map((interest) => (
                  <button
                    key={interest}
                    className="px-4 py-2 border border-gray-300 rounded-full text-sm hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700 transition"
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Preferred Categories
              </label>
              <p className="text-sm text-gray-600 mb-3">
                What types of products do you want to see?
              </p>
              <div className="flex flex-wrap gap-2">
                {['B2B', 'B2C', 'Open Source', 'Web Apps', 'Mobile Apps', 'APIs', 'Chrome Extensions'].map((category) => (
                  <button
                    key={category}
                    className="px-4 py-2 border border-gray-300 rounded-full text-sm hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700 transition"
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Update Frequency */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Update Frequency
              </label>
              <p className="text-sm text-gray-600 mb-3">
                How often do you want to receive product digests?
              </p>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="daily">Daily</option>
                <option value="weekly" defaultChecked>Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="on_demand">On-demand only</option>
              </select>
            </div>

            {/* Email Notifications */}
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-sm">Email Notifications</div>
                  <div className="text-sm text-gray-600">
                    Receive product digests via email
                  </div>
                </div>
              </label>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
                Save Preferences
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Note: Authentication and preference saving will be implemented in the next phase.
          </p>
        </div>
      </main>
    </div>
  );
}
