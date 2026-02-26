"use client";
import React, { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Play, Send, ChevronRight, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-62e6c0e8`;

export const CodingPage = () => {
  const [code, setCode] = useState(`// Try running this JavaScript code!
console.log("Hello, Smart Hire!");
const sum = (a, b) => a + b;
console.log("Sum of 5 and 7 is:", sum(5, 7));
`);

  const [output, setOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'problem' | 'submissions'>('problem');

  const runCode = async () => {
    setIsRunning(true);
    setOutput("Running...");
    try {
      const response = await fetch(`${SERVER_URL}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ code, language: 'javascript' })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Execution failed');
      
      setOutput(data.output);
      toast.success('Code executed');
    } catch (error: any) {
      console.error(error);
      setOutput(`Error: ${error.message}`);
      toast.error('Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-900 text-slate-300">
      {/* Top Bar */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-white">1. Two Sum</h2>
            <Badge variant="outline" className="border-green-500 text-green-500 bg-transparent">Easy</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-700 px-3 py-1.5 rounded text-sm">
            <Clock size={16} />
            <span>00:45:22</span>
          </div>
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={runCode} 
            isLoading={isRunning}
            leftIcon={<Play size={16} />}
          >
            Run
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" leftIcon={<Send size={16} />}>Submit</Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Problem Description */}
        <div className="w-[40%] flex flex-col border-r border-slate-700 bg-slate-900 overflow-y-auto">
          <div className="flex border-b border-slate-700">
            <button 
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'problem' ? 'text-white border-b-2 border-indigo-500' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setActiveTab('problem')}
            >
              Description
            </button>
            <button 
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'submissions' ? 'text-white border-b-2 border-indigo-500' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setActiveTab('submissions')}
            >
              Submissions
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'problem' ? (
              <>
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Problem Description</h3>
                  <p className="leading-relaxed text-slate-300">
                    Given an array of integers <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-400">nums</code> and an integer <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-400">target</code>, return indices of the two numbers such that they add up to <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-400">target</code>.
                  </p>
                  <p className="leading-relaxed text-slate-300 mt-4">
                    You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.
                  </p>
                  <p className="leading-relaxed text-slate-300 mt-4">
                    You can return the answer in any order.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-3">Example 1:</h4>
                  <div className="bg-slate-800 p-4 rounded-lg font-mono text-sm">
                    <div className="mb-2"><span className="text-slate-500">Input:</span> nums = [2,7,11,15], target = 9</div>
                    <div className="mb-2"><span className="text-slate-500">Output:</span> [0,1]</div>
                    <div><span className="text-slate-500">Explanation:</span> Because nums[0] + nums[1] == 9, we return [0, 1].</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-3">Constraints:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>2 &le; nums.length &le; 10<sup>4</sup></li>
                    <li>-10<sup>9</sup> &le; nums[i] &le; 10<sup>9</sup></li>
                    <li>-10<sup>9</sup> &le; target &le; 10<sup>9</sup></li>
                    <li>Only one valid answer exists.</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-slate-500">
                No submissions yet.
              </div>
            )}
          </div>
        </div>

        <div className="w-1 bg-slate-700" />

        {/* Right Panel: Code Editor & Console */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col">
            <div className="h-[70%] bg-[#1e1e1e] flex flex-col">
              <div className="h-full flex flex-col">
                <div className="h-10 bg-[#252526] flex items-center px-4 border-b border-[#333]">
                  <span className="text-sm text-yellow-500 font-medium">JavaScript</span>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 w-full bg-[#1e1e1e] text-slate-200 font-mono p-4 resize-none outline-none text-sm leading-6"
                  spellCheck={false}
                />
              </div>
            </div>
            
            <div className="h-1 bg-slate-700" />
            
            <div className="flex-1 bg-slate-900 flex flex-col overflow-y-auto">
               <div className="h-10 bg-slate-800 flex items-center px-4 border-b border-slate-700 justify-between">
                  <span className="text-sm font-medium text-slate-300">Console</span>
                  <div className="flex gap-2">
                    <button className="text-xs text-slate-400 hover:text-white" onClick={() => setOutput(null)}>Clear</button>
                  </div>
                </div>
                <div className="flex-1 p-4 font-mono text-sm overflow-auto">
                  {output ? (
                    <pre className="text-green-400 whitespace-pre-wrap">{output}</pre>
                  ) : (
                    <div className="text-slate-500 italic">Run your code to see results here...</div>
                  )}
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
