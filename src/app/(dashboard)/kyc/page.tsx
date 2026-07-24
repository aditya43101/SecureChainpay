"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Shield, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";

const steps = [
  { id: "aadhaar", title: "Aadhaar Card", description: "Upload front and back of Aadhaar" },
  { id: "pan", title: "PAN Card", description: "Upload your PAN card" },
  { id: "selfie", title: "Selfie", description: "Take a clear selfie" },
  { id: "review", title: "Review", description: "Review and submit" },
];

export default function KYCPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    aadhaar: null,
    pan: null,
    selfie: null,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [type]: e.target.files[0] });
    }
  };

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      if (files.aadhaar) formData.append("aadhaar", files.aadhaar);
      if (files.pan) formData.append("pan", files.pan);
      if (files.selfie) formData.append("selfie", files.selfie);
      formData.append("userId", "user-123"); // Mock user ID

      const res = await fetch("/api/kyc", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setSuccess(true);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <Shield className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-4 text-3xl font-extrabold text-gray-900 dark:text-white">Identity Verification</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Complete your KYC to unlock full account features</p>
        </div>

        {success ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center"
          >
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verification Submitted</h3>
            <p className="text-gray-600 dark:text-gray-400">Your documents are under review. We will notify you once verified.</p>
          </motion.div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {steps.map((step, index) => (
                <div 
                  key={step.id} 
                  className={`flex-1 py-4 px-6 text-center text-sm font-medium border-b-2 transition-colors ${
                    index === currentStep 
                      ? "border-blue-600 text-blue-600" 
                      : index < currentStep 
                        ? "border-green-500 text-green-500" 
                        : "border-transparent text-gray-500"
                  }`}
                >
                  {step.title}
                </div>
              ))}
            </div>

            <div className="p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentStep < 3 ? (
                    <div className="space-y-6 text-center">
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 hover:border-blue-500 transition-colors cursor-pointer relative">
                        <input 
                          type="file" 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          onChange={(e) => handleFileChange(e, steps[currentStep].id)}
                          accept="image/*,.pdf"
                        />
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-lg font-medium text-gray-900 dark:text-white">
                          {files[steps[currentStep].id] ? files[steps[currentStep].id]?.name : `Upload your ${steps[currentStep].title}`}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">JPEG, PNG, or PDF up to 10MB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Review your documents</h3>
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {Object.entries(files).map(([key, file]) => (
                          <li key={key} className="py-4 flex items-center justify-between">
                            <span className="capitalize text-gray-700 dark:text-gray-300">{key}</span>
                            <span className="text-sm text-gray-500">{file ? file.name : "Missing"}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 0 || loading}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </button>
                {currentStep < steps.length - 1 ? (
                  <button
                    onClick={nextStep}
                    disabled={!files[steps[currentStep].id]}
                    className="flex items-center px-4 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !files.aadhaar || !files.pan || !files.selfie}
                    className="flex items-center px-6 py-2 bg-green-600 rounded-lg text-white hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    {loading ? "Submitting..." : "Submit KYC"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
