import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProblemForm, type ProblemFormData } from '../components/problem/ProblemForm';
import { problemsRepo } from '../db';
import { useToast } from '../hooks/useToast';

export const AddProblemPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: ProblemFormData) => {
    try {
      setIsSubmitting(true);
      const created = await problemsRepo.create({
        ...data,
        confidence: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        dateFirstAttempt: data.status !== 'Not Started' ? new Date().toISOString() : null,
        dateSolved: data.status === 'Solved' ? new Date().toISOString() : null,
      });

      toast.success(`Created problem "${created.title}"`);
      navigate(`/problem/${created.id}`);
    } catch (err) {
      console.error('Failed to create problem:', err);
      toast.error('Failed to create problem. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Add New Problem
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Enter Leetcode problem details to track your practice and unlock AI guidance.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <ProblemForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitButtonText="Create Problem"
          cancelHref="/"
        />
      </div>
    </div>
  );
};

export default AddProblemPage;
