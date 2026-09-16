import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ProblemForm, type ProblemFormData } from '../components/problem/ProblemForm';
import { problemsRepo } from '../db';
import type { Problem } from '../types';
import { useToast } from '../hooks/useToast';

export const EditProblemPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    problemsRepo.getById(id).then((p) => {
      setProblem(p || null);
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (data: ProblemFormData) => {
    if (!id) return;
    try {
      setIsSubmitting(true);
      await problemsRepo.update(id, {
        number: data.number,
        title: data.title,
        url: data.url,
        statement: data.statement,
        difficulty: data.difficulty,
        topics: data.topics,
        patterns: data.patterns,
        status: data.status,
        language: data.language,
        timeSpentMinutes: data.timeSpentMinutes,
      });

      toast.success('Problem updated successfully');
      navigate(`/problem/${id}`);
    } catch (err) {
      console.error('Failed to update problem:', err);
      toast.error('Failed to update problem');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Loading problem details...
      </div>
    );
  }

  if (!problem || !id) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Problem Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">The problem you are trying to edit does not exist.</p>
        <Link to="/" className="inline-block mt-4 text-indigo-600 dark:text-indigo-400 font-medium">
          Back to Problem List
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Edit Problem
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Update problem statement, metadata, or taxonomy tags.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <ProblemForm
          initialData={problem}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitButtonText="Save Changes"
          cancelHref={`/problem/${id}`}
        />
      </div>
    </div>
  );
};

export default EditProblemPage;
