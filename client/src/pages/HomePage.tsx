import { Link } from "react-router";

function HomePage() {
  return (
    <div className="h-screen bg-[#252a33] flex justify-center items-center flex-col space-x-4 text-white">
      <div className="py-4">
        <Link to="/share">Go to share page</Link>
      </div>
    </div>
  );
}

export default HomePage;
