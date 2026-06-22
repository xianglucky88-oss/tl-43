import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Workshop from "@/pages/Workshop";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Workshop />} />
      </Routes>
    </Router>
  );
}
