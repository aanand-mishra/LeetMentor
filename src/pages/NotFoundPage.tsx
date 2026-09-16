import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="p-12 text-center">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">404 - Page Not Found</h1>
      <p className="text-slate-600 dark:text-slate-400 mt-2">The page you are looking for does not exist.</p>
      <Link
        to="/"
        className="inline-block mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium"
      >
        Back to Home
      </Link>
    </div>
  );
};
export default NotFoundPage;
