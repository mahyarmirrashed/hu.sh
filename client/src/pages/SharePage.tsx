import { Link } from "react-router";

function SharePage() {
  return (
    <div className="h-screen bg-[#252a33] flex justify-center items-center flex-col space-x-4 text-white">
      <div className="py-4">
        <Link to="/">Go to home page</Link>
      </div>
    </div>
  );
}

export default SharePage;
