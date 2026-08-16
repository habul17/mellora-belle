import { useState, useEffect } from 'react'


function App() {

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHealth() {
      try {
        const response = await fetch("http://localhost:4000/health");
        const data = await response.json();

        setStatus(data.status);

      } catch (err) {
        setError("Could not reach the server");
      } finally {
        setLoading(false);
      }
    }
    loadHealth();
  }, [])

  let content = "";

  if (loading) {
    content = "Loading...";
  } else if (error) {
    content = error;
  } else {
    content = status;
  }

  return (
    <div>
      {content}
    </div>
  )

}

export default App
