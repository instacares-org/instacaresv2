export default function AuthError({ searchParams }: { searchParams: { error?: string } }) {
  const error = searchParams?.error;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
          <p className="text-gray-600 mb-4">
            There was a problem signing you in. Please try again.
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-sm text-red-700">Error: {error}</p>
            </div>
          )}
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Return to Home
          </a>
        </div>
      </div>
    </div>
  );
}