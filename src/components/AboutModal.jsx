export function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-lg font-bold">বলাকা সম্পর্কে</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h3 className="font-bold text-gray-900 mb-1">এটি কী?</h3>
            <p>
              বলাকা বাংলায় লেখার একটি জায়গা — ছোট ছোট পোস্ট, আলোচনা, ছবি।
              এটি ফেসবুক বা টুইটারের মতো দেখতে, কিন্তু ভিতরের ব্যবস্থা আলাদা।
              আপনার পোস্ট কোনো একটি কোম্পানির সার্ভারে থাকে না — এটি
              ছড়িয়ে থাকে অনেকগুলো সার্ভারে। কোনো একটি বন্ধ হলেও আপনার লেখা
              হারায় না।
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-1">কে বানিয়েছে?</h3>
            <p>
              অরিন্দম একটি ছোট প্রজেক্ট হিসেবে, শখের বশে। এটির পিছনে
              কোনো কোম্পানি নেই, বিজ্ঞাপন নেই।
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-1">
              কীভাবে ব্যবহার করবেন
            </h3>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li>
                <strong>অ্যাকাউন্ট তৈরি করুন।</strong> "নতুন অ্যাকাউন্ট"
                চাপলে একটি গোপন চাবি (nsec) দেখানো হবে। এটি কপি করে কোথাও
                লিখে রাখুন — না হলে পরে আর আপনার অ্যাকাউন্টে ঢুকতে পারবেন না।
              </li>
              <li>
                <strong>নাম ও পরিচয় দিন।</strong> নিজের নাম, ছবি, পরিচিতি
                দিয়ে লিখে রাখুন যদি ইচ্ছে হয়। না দিলেও অসুবিধা নেই — সেক্ষেত্রে
                শুধু আপনার npub টুকু ব্যবহার করলেই হবে। সেটাও কোথাও টুকে বা
                লিখে রাখুন।
              </li>
              <li>
                <strong>পোস্ট করুন।</strong> উপরের বাক্সে ইংরেজি অক্ষরে বাংলা
                লিখুন — যেমন{" "}
                <code className="bg-gray-100 px-1 rounded">
                  ami banglay likhi
                </code>{" "}
                লিখলে হবে <strong>আমি বাংলায় লিখি</strong>।
              </li>
              <li>
                <strong>বন্ধু খুঁজুন।</strong> "খোঁজ" ট্যাবে কারও npub পেস্ট
                করলে তার সব পোস্ট দেখতে পাবেন। পছন্দ হলে "অনুসরণ" চাপুন।
              </li>
              <li>
                <strong>উত্তর দিন, লাইক দিন।</strong> যেকোনো পোস্টে 💬 উত্তর,
                ❤️ ভাল লাগল, বা 👍 পছন্দ চাপতে পারেন।
              </li>
            </ol>
          </section>

          <section className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <h3 className="font-bold text-amber-900 mb-1">
              ⚠️ সবচেয়ে গুরুত্বপূর্ণ কথা
            </h3>
            <p className="text-amber-900">
              <strong>আপনার nsec চাবিটি হারাবেন না।</strong> এটি আপনার
              পরিচয়। এটি হারালে আপনার অ্যাকাউন্ট ফিরে পাওয়ার কোনো উপায় নেই।
              কপি করে পাসওয়ার্ড ম্যানেজারে বা কাগজে লিখে রাখুন। এবং{" "}
              <strong>কাউকে দেখাবেন না</strong> — যে এটি পাবে, সে আপনার
              হয়ে পোস্ট করতে পারবে।
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-1">
              শুরুর সময় কী আশা করবেন
            </h3>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>প্রথমবার লোড হতে ২–৪ সেকেন্ড লাগবে — এটি স্বাভাবিক।</li>
              <li>
                শুরুতে ফিড প্রায় খালি থাকবে, কারণ আপনি এখনো কাউকে অনুসরণ
                করেননি। প্রথমে ২–৩ জনকে অনুসরণ করুন।
              </li>
              <li>
                পোস্ট করার সাথে সাথেই উত্তর পাবেন না। এখনো ব্যবহারকারী
                কম। আপনি যাদের চেনেন, তাঁদের বলুন যোগ দিতে।
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-1">সাহায্য দরকার?</h3>
            <p>
              কোনো সমস্যা হলে বলাকায় আমাকে (অরিন্দম) সরাসরি পোস্টে উত্তর
              দিন বা মেসেজ করুন। আমি সব পড়ি।
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}