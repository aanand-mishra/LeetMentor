import { db, problemsRepo, attemptsRepo, mentorRepo, noteReviewsRepo } from './index';
import type { Difficulty, Status, CodeReview } from '../types';
import { TAXONOMY_TOPICS, TAXONOMY_PATTERNS } from '../types';

const REALISTIC_PROBLEMS: Array<{
  number: number;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  patterns: string[];
  statement: string;
}> = [
    {
      number: 1,
      title: 'Two Sum',
      difficulty: 'Easy',
      topics: ['Array', 'Hash Table'],
      patterns: ['Two Pointers'],
      statement:
        'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.',
    },
    {
      number: 3,
      title: 'Longest Substring Without Repeating Characters',
      difficulty: 'Medium',
      topics: ['Hash Table', 'String'],
      patterns: ['Sliding Window'],
      statement:
        'Given a string s, find the length of the longest substring without duplicate characters.',
    },
    {
      number: 4,
      title: 'Median of Two Sorted Arrays',
      difficulty: 'Hard',
      topics: ['Array', 'Binary Search', 'Divide & Conquer'],
      patterns: ['Binary Search'],
      statement:
        'Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays. The overall run time complexity should be O(log (m+n)).',
    },
    {
      number: 11,
      title: 'Container With Most Water',
      difficulty: 'Medium',
      topics: ['Array', 'Greedy'],
      patterns: ['Two Pointers'],
      statement:
        'You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]). Find two lines that together with the x-axis form a container, such that the container contains the most water.',
    },
    {
      number: 15,
      title: '3Sum',
      difficulty: 'Medium',
      topics: ['Array', 'Sorting'],
      patterns: ['Two Pointers'],
      statement:
        'Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0. Notice that the solution set must not contain duplicate triplets.',
    },
    {
      number: 20,
      title: 'Valid Parentheses',
      difficulty: 'Easy',
      topics: ['String', 'Stack'],
      patterns: ['Monotonic Stack'],
      statement:
        'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid.\n\nAn input string is valid if open brackets are closed by the same type of brackets in the correct order.',
    },
    {
      number: 21,
      title: 'Merge Two Sorted Lists',
      difficulty: 'Easy',
      topics: ['Linked List', 'Recursion'],
      patterns: ['Two Pointers'],
      statement:
        'You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists.',
    },
    {
      number: 42,
      title: 'Trapping Rain Water',
      difficulty: 'Hard',
      topics: ['Array', 'Stack', 'Dynamic Programming'],
      patterns: ['Two Pointers', 'Monotonic Stack'],
      statement:
        'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
    },
    {
      number: 53,
      title: 'Maximum Subarray',
      difficulty: 'Medium',
      topics: ['Array', 'Dynamic Programming', 'Divide & Conquer'],
      patterns: ["Kadane's"],
      statement:
        'Given an integer array nums, find the subarray with the largest sum, and return its sum.',
    },
    {
      number: 70,
      title: 'Climbing Stairs',
      difficulty: 'Easy',
      topics: ['Math', 'Dynamic Programming', 'Memoization'],
      patterns: ['Memoization', 'Tabulation'],
      statement:
        'You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?',
    },
    {
      number: 76,
      title: 'Minimum Window Substring',
      difficulty: 'Hard',
      topics: ['Hash Table', 'String'],
      patterns: ['Sliding Window'],
      statement:
        'Given two strings s and t of lengths m and n respectively, return the minimum window substring of s such that every character in t (including duplicates) is included in the window.',
    },
    {
      number: 121,
      title: 'Best Time to Buy and Sell Stock',
      difficulty: 'Easy',
      topics: ['Array', 'Dynamic Programming'],
      patterns: ['Sliding Window', 'Two Pointers'],
      statement:
        'You are given an array prices where prices[i] is the price of a given stock on the ith day. Return the maximum profit you can achieve from this transaction.',
    },
    {
      number: 141,
      title: 'Linked List Cycle',
      difficulty: 'Easy',
      topics: ['Hash Table', 'Linked List'],
      patterns: ['Fast & Slow Pointers'],
      statement:
        'Given head, the head of a linked list, determine if the linked list has a cycle in it.',
    },
    {
      number: 198,
      title: 'House Robber',
      difficulty: 'Medium',
      topics: ['Array', 'Dynamic Programming'],
      patterns: ['Tabulation', 'Memoization'],
      statement:
        'You are a professional robber planning to rob houses along a street. Each house has a certain amount of money stashed. Return the maximum amount of money you can rob tonight without alerting the police (cannot rob adjacent houses).',
    },
    {
      number: 200,
      title: 'Number of Islands',
      difficulty: 'Medium',
      topics: ['Array', 'Matrix', 'Union Find'],
      patterns: ['BFS', 'DFS'],
      statement:
        'Given an m x n 2D binary grid grid which represents a map of "1"s (land) and "0"s (water), return the number of islands.',
    },
    {
      number: 206,
      title: 'Reverse Linked List',
      difficulty: 'Easy',
      topics: ['Linked List', 'Recursion'],
      patterns: ['In-place Reversal'],
      statement: 'Given the head of a singly linked list, reverse the list, and return the reversed list.',
    },
    {
      number: 236,
      title: 'Lowest Common Ancestor of a Binary Tree',
      difficulty: 'Medium',
      topics: ['Tree', 'Binary Tree', 'DFS'],
      patterns: ['DFS'],
      statement:
        'Given a binary tree, find the lowest common ancestor (LCA) of two given nodes in the tree.',
    },
    {
      number: 295,
      title: 'Find Median from Data Stream',
      difficulty: 'Hard',
      topics: ['Heap', 'Design', 'Sorting'],
      patterns: ['Top-K Elements'],
      statement:
        'The median is the middle value in an ordered integer list. Implement the MedianFinder class with two priority queues.',
    },
    {
      number: 300,
      title: 'Longest Increasing Subsequence',
      difficulty: 'Medium',
      topics: ['Array', 'Binary Search', 'Dynamic Programming'],
      patterns: ['Tabulation', 'Binary Search'],
      statement:
        'Given an integer array nums, return the length of the longest strictly increasing subsequence.',
    },
    {
      number: 322,
      title: 'Coin Change',
      difficulty: 'Medium',
      topics: ['Array', 'Dynamic Programming', 'BFS'],
      patterns: ['Tabulation', 'BFS'],
      statement:
        'You are given an integer array coins representing coins of different denominations and an integer amount representing a total amount of money. Return the fewest number of coins that you need to make up that amount.',
    },
  ];

const SAMPLE_PASS_REVIEW: CodeReview = {
  verdict: 'pass',
  summary: 'Optimal O(n) solution using a single-pass hash map. Clean variable naming and robust handling of duplicates.',
  correctness: {
    status: 'correct',
    failingCases: [],
  },
  complexity: {
    time: 'O(n)',
    space: 'O(n)',
    optimalTime: 'O(n)',
    optimalSpace: 'O(n)',
    isOptimal: true,
  },
  issues: [],
  positives: [
    'Single-pass approach eliminates unnecessary work.',
    'Clear logic and proper edge-case considerations.',
  ],
  nextStep: 'Try solving the follow-up 3Sum problem or handling sorted array variations with Two Pointers.',
  model: 'gemini-flash-lite-latest',
  createdAt: new Date().toISOString(),
};

const SAMPLE_REVISE_REVIEW: CodeReview = {
  verdict: 'revise',
  summary: 'The nested loop brute-force approach has O(n^2) time complexity and will encounter Time Limit Exceeded on larger inputs.',
  correctness: {
    status: 'fails_edge_cases',
    failingCases: ['Large array input with 10^5 elements (TLE)', 'Negative targets with zeros'],
  },
  complexity: {
    time: 'O(n^2)',
    space: 'O(1)',
    optimalTime: 'O(n)',
    optimalSpace: 'O(n)',
    isOptimal: false,
  },
  issues: [
    {
      severity: 'major',
      title: 'Quadratic Time Complexity',
      detail: 'Nested iteration over nums causes O(n^2) runtime.',
      suggestion: 'Trade space for time by storing seen elements in a hash map as you iterate.',
    },
    {
      severity: 'minor',
      title: 'Redundant Inner Index Bound',
      detail: 'Inner loop starts from index 0 instead of i + 1, leading to duplicate comparisons.',
      suggestion: 'Start inner loop from i + 1 to avoid redundant pairs.',
    },
  ],
  positives: ['Correctly identified the addition condition.'],
  nextStep: 'Replace the inner loop with a dictionary/hash map lookup to achieve O(n) time.',
  model: 'gemini-flash-lite-latest',
  createdAt: new Date().toISOString(),
};

export async function seedDatabase(count: number = 200): Promise<{ problemsCount: number }> {
  // Clear first to ensure clean state
  await db.transaction('rw', [db.problems, db.attempts, db.mentorMessages, db.noteReviews], async () => {
    await db.problems.clear();
    await db.attempts.clear();
    await db.mentorMessages.clear();
    await db.noteReviews.clear();
  });

  const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
  const statuses: Status[] = ['Not Started', 'In Progress', 'Solved'];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const baseProblem = REALISTIC_PROBLEMS[i % REALISTIC_PROBLEMS.length];
    const problemNumber = i < REALISTIC_PROBLEMS.length ? baseProblem.number : 1000 + i;
    const title =
      i < REALISTIC_PROBLEMS.length
        ? baseProblem.title
        : `${baseProblem.title} (Variant ${Math.floor(i / REALISTIC_PROBLEMS.length) + 1})`;

    const difficulty = i < REALISTIC_PROBLEMS.length ? baseProblem.difficulty : difficulties[i % 3];
    const status = statuses[i % 3];

    // Dates
    const daysAgo = Math.floor(Math.random() * 30);
    const dateAdded = new Date(now - daysAgo * 24 * 3600 * 1000).toISOString();
    const dateFirstAttempt = status !== 'Not Started' ? dateAdded : null;
    const dateSolved =
      status === 'Solved'
        ? new Date(now - Math.max(0, daysAgo - 2) * 24 * 3600 * 1000).toISOString()
        : null;

    // Confidence: set when solved
    let confidence: 1 | 2 | 3 | 4 | 5 | null = null;
    if (status === 'Solved') {
      confidence = ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5;
    }

    const hintsUsed = (status === 'Not Started' ? 0 : (i % 5)) as 0 | 1 | 2 | 3 | 4;

    const topic1 = TAXONOMY_TOPICS[i % TAXONOMY_TOPICS.length];
    const topic2 = TAXONOMY_TOPICS[(i + 3) % TAXONOMY_TOPICS.length];
    const topics = Array.from(new Set([topic1, topic2]));

    const pattern1 = TAXONOMY_PATTERNS[i % TAXONOMY_PATTERNS.length];
    const patterns = [pattern1];

    const problem = await problemsRepo.create({
      number: problemNumber,
      title,
      url: `https://leetcode.com/problems/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
      statement: baseProblem.statement,
      difficulty,
      topics,
      patterns,
      status,
      confidence,
      timeSpentMinutes: status !== 'Not Started' ? 15 + (i % 45) : null,
      hintsUsed,
      starred: i % 4 === 0,
      userTimeComplexity: status === 'Solved' ? 'O(n)' : null,
      userSpaceComplexity: status === 'Solved' ? 'O(n)' : null,
      notes:
        status === 'Solved'
          ? `### Key Insight\nStore seen values in a map so the target complement can be queried in O(1).\n\n### Complexity\n- Time: O(n)\n- Space: O(n)`
          : '',
      language: 'python',
      dateFirstAttempt,
      dateSolved,
    });

    // Update dateAdded to match mock history
    await db.problems.update(problem.id, { dateAdded });

    // If In Progress or Solved, create mock attempts
    if (status === 'In Progress' && count <= 200) {
      // 1 attempt with revise review
      await attemptsRepo.create({
        problemId: problem.id,
        code: `class Solution:\n    def solve(self, nums, target):\n        for i in range(len(nums)):\n            for j in range(len(nums)):\n                if nums[i] + nums[j] == target:\n                    return [i, j]\n`,
        language: 'python',
        userComment: 'Initial brute force attempt',
        review: SAMPLE_REVISE_REVIEW,
      });
    } else if (status === 'Solved' && count <= 200) {
      // 2 attempts: 1 revise, 1 pass
      await attemptsRepo.create({
        problemId: problem.id,
        code: `class Solution:\n    def solve(self, nums, target):\n        # First try\n        pass\n`,
        language: 'python',
        userComment: 'First try',
        review: SAMPLE_REVISE_REVIEW,
      });
      await attemptsRepo.create({
        problemId: problem.id,
        code: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        seen = {}\n        for i, x in enumerate(nums):\n            comp = target - x\n            if comp in seen:\n                return [seen[comp], i]\n            seen[x] = i\n        return []\n`,
        language: 'python',
        userComment: 'Optimized with hash map lookup',
        review: SAMPLE_PASS_REVIEW,
      });

      // Also create a sample note review
      await noteReviewsRepo.create({
        problemId: problem.id,
        notesSnapshot: problem.notes,
        rating: 4,
        verdict: 'solid',
        corrections: [],
        gaps: ['Could mention memory overhead in large input streams.'],
        strengths: ['Accurate time and space complexity derivation.', 'Generalized beyond Two Sum.'],
        keyTakeaway: 'Whenever pair-matching with an arithmetic constraint, swap nested iterations for a hash map to achieve O(1) complement checks.',
        recallQuestions: [
          'What happens when the input contains duplicates that sum to the target?',
          'How would you solve this if the array was already sorted in non-decreasing order?',
          'What is the space-time tradeoff between Two Pointers and Hash Map?',
        ],
        model: 'gemini-flash-lite-latest',
      });
    }

    // Add mentor hints if hintsUsed > 0
    if (hintsUsed >= 1 && count <= 200) {
      await mentorRepo.saveMessage({
        problemId: problem.id,
        level: 1,
        content:
          'What information are you throwing away each time the inner loop checks an element? Can you remember what you have already inspected?',
        model: 'gemini-flash-lite-latest',
      });
    }
    if (hintsUsed >= 2 && count <= 200) {
      await mentorRepo.saveMessage({
        problemId: problem.id,
        level: 2,
        content:
          'Hash Map pattern: store the value and index as you iterate. When at index `i`, check if `target - nums[i]` already exists in the map.',
        model: 'gemini-flash-lite-latest',
      });
    }
  }

  const finalCount = await db.problems.count();
  return { problemsCount: finalCount };
}

export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', [db.problems, db.attempts, db.mentorMessages, db.noteReviews], async () => {
    await db.problems.clear();
    await db.attempts.clear();
    await db.mentorMessages.clear();
    await db.noteReviews.clear();
  });
}
