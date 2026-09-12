import { useState } from "react";
import { CraneIcon } from "./CraneIcon";

const SLIDES = [
  {
    icon: "🕊️",
    title: "বলাকা",
    subtitle: "বাংলায় কথা বলার জায়গা",
    body: "বলাকা একটি বিকেন্দ্রীভূত সোশ্যাল নেটওয়ার্ক — যেখানে আপনার পোস্ট কোনো কোম্পানির নয়, সরাসরি আপনার। কোনো বিজ্ঞাপন নেই, কোনো অ্যালগরিদম নেই, কোনো হস্তক্ষেপ নেই।",
  },
  {
    icon: "🔑",
    title: "আপনার চাবি, আপনার পরিচয়",
    subtitle: "কোনো পাসওয়ার্ড নেই, কোনো ইমেইল নেই",
    body: "যোগ দেওয়ার জন্য আপনার ব্রাউজারে একটি গোপন চাবি তৈরি হবে। এই চাবিই আপনার পরিচয় — এটি কোনো সার্ভারে যায় না, শুধু আপনার কাছে থাকে। এটি সংরক্ষণ করা অত্যন্ত জরুরি।",
  },
  {
    icon: "✍️",
    title: "বাংলায় লিখুন",
    subtitle: "ইংরেজি অক্ষরে টাইপ করলে বাংলায় রূপান্তরিত হবে",
    body: "যেমন “ami banglay likhi” লিখলে হবে “আমি বাংলায় লিখি”। ইংরেজিতে লিখতে চাইলে পোস্ট বাক্সের পাশে অ/A বাটনে ক্লিক করুন।",
  },

    {
    icon: "🌐",
    title: "কী দেখবেন, আপনি ঠিক করবেন",
    subtitle: "শুধু বাংলা, নাকি সব ভাষা?",
    body: "ফিডের উপরের ডান দিকের কোণে একটি ছোট বোতাম আছে — অ / অ EN। চাপ দিলে শুধু বাংলা পোস্ট দেখতে পাবেন। আবার চাপ দিলে বাংলা ও ইংরেজি দুই ভাষার পোস্ট ফিরে আসবে। আপনার পছন্দ মনে রাখা হবে।",
  },


];

export function WelcomeScreen({ onComplete }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top bar with skip */}
      <div className="flex justify-between items-center p-4">
        <div className="flex items-center gap-2">
          <CraneIcon className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-text">বলাকা</span>
        </div>
        <button
          onClick={onComplete}
          className="text-sm text-muted hover:text-text"
        >
          এড়িয়ে যান
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center max-w-md mx-auto">
        <div className="text-6xl mb-6">{slide.icon}</div>
        <h1 className="text-2xl font-bold text-text mb-2">{slide.title}</h1>
        <p className="text-sm text-muted mb-6">{slide.subtitle}</p>
        <p className="text-base text-text leading-relaxed">{slide.body}</p>
      </div>

      {/* Bottom navigation */}
      <div className="p-6 max-w-md mx-auto w-full">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-blue-600" : "w-2 bg-gray-300"
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {index > 0 && (
            <button
              onClick={handleBack}
              className="px-5 py-3 rounded-full border border-gray-300 text-text font-medium hover:bg-gray-50"
            >
              পিছনে
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 px-5 py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            {isLast ? "শুরু করুন" : "পরবর্তী"}
          </button>
        </div>
      </div>
    </div>
  );
}