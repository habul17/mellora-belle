import { useState, useEffect } from 'react'


function App() {

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getProducts() {
      try {
        const response = await fetch("http://localhost:4000/products");
        const data = await response.json();

        setProducts(data.products);

      } catch (err) {
        setError("Could not reach the server");
      } finally {
        setLoading(false);
      }
    }
    getProducts();
  }, [])

  let content = "";

  if (loading) {
    content = "Loading...";
  } else if (error) {
    content = error;
  } else {
    content = JSON.stringify(products);
  }

  return (
    <div>
      {content}
    </div>
  )

}

export default App
