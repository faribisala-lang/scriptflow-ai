import { useState } from 'react';

function App() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">ScriptFlow AI</h1>
        <p className="text-xl text-gray-400 mb-8">
          Bulk Video-to-Script Engine - AI-powered video transcription
        </p>
        
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center">
          <input
            type="file"
            multiple
            accept="video/*"
            onChange={(e) => {
              if (e.target.files) {
                setFiles(Array.from(e.target.files));
              }
            }}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer text-gray-400 hover:text-white"
          >
            <div className="text-6xl mb-4">📹</div>
            <p className="text-lg">Click to upload videos or drag and drop</p>
          </label>
          
          {files.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Selected Files:</h3>
              <ul className="text-left space-y-2">
                {files.map((file, index) => (
                  <li key={index} className="text-gray-400">
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
