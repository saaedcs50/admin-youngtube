# AI_REVIEW_INSTRUCTIONS — تعليمات وقواعد العمل الإلزامية للذكاء الاصطناعي

## 1. طبيعة المشروع (Project Nature)
هذا المشروع هو تطبيق لوحة إدارة مستقلة (Admin Application) يتعامل مع الـ Cloudflare Worker الخاص بـ YoungTube.
- لا تفترض أبداً أن وجود endpoint أو feature في Admin يعني بالضرورة وجوده في Worker، والعكس صحيح.
- عند فحص أي integration:
  1. افحص كود الـ Admin.
  2. افحص عقد الـ Worker الموثق في `WORKER_CLOUDFLARE.md`.
  3. تحقق من طريقة التوثيق والمصادقة (Authorization method).
  4. تحقق من شكل الطلب والاستجابة (Request/Response shape).
  5. لا تخترع أي endpoint غير موثق.

## 2. ترتيب الأولوية عند وجود تعارض (Priority Order)
1. **الكود الفعلي** هو مصدر الحقيقة الأساسي للحالة الحالية (Source of Truth).
2. `PROJECT_CONTEXT.md` للبنية المعمارية والقواعد (Architecture and Rules).
3. `HANDOFF.md` لآخر حالة تنفيذية (Latest Execution State).
4. `WORKER_CLOUDFLARE.md` لعقود ومواصفات الـ Worker (Worker Contract).
5. `AI_REVIEW_INSTRUCTIONS.md` لقواعد التنفيذ والتوثيق (Execution and Documentation Rules).

## 3. قواعد ما قبل أي تعديل (Pre-Modification Protocol)
في كل مهمة جديدة:
- اقرأ الملفات الأربعة قبل تعديل أي كود.
- افحص التطبيق الحالي (Current Implementation).
- لا تعيد تنفيذ ميزة موجودة بالفعل (Do not reimplement existing features).
- لا تنشئ مكونات مكررة أو طبقات API مكررة (No duplicate components or API layers).
- لا تغيّر بنية المصادقة (Authentication Architecture) بدون سبب صريح ومبرر.
- لا تغيّر عقد الـ Worker لمجرد حل مشكلة محلية في الـ Admin.
- لا تحذف وظيفة موجودة بدون تبرير صريح ومؤكد.

## 4. القواعد الإلزامية الدائمة للتوثيق (Mandatory Documentation Rules)
أي تعديل فعلي في الكود يجب أن يُسجَّل في ملفات التوثيق قبل إنهاء المهمة:

### أ. تحديث `HANDOFF.md` بعد كل مهمة:
يجب أن يحتوي التحديث على:
- التعديل الذي تم.
- الملفات المتأثرة.
- السبب.
- النتيجة.
- الاختبارات التي تمت.
- الاختبارات التي لم تتم.
- المشاكل المتبقية.
- الخطوة التالية.

### ب. تحديث `PROJECT_CONTEXT.md`:
يتم التحديث عند تغيّر:
- البنية المعمارية (Architecture).
- تدفق البيانات (Data flow).
- السلوك الدائم للميزات (Permanent feature behavior).
- تكامل الـ API (API integration).
- المصادقة والتوثيق (Authentication).
- أي قرار تنفيذي جوهري (Important implementation decision).

### ج. تحديث `WORKER_CLOUDFLARE.md`:
يتم التحديث عند تغيّر:
- أي Endpoint.
- شكل وعقود الطلب/الاستجابة (Request/Response contract).
- مصادقة الـ Worker.
- تكامل الـ KV.
- ربط خدمات Cloudflare (Bindings).
- سلوك النشر (Deployment behavior).

## 5. قواعد حالات الاختبار (Test Status Rules)
استخدم فقط التصنيفات الأربعة التالية:
- `PASS`: تم اختباره فعلياً في بيئة التشغيل ونجح (Runtime/actual test succeeded).
- `SOURCE-OK`: تم التحقق منه على مستوى فحص الكود فقط بدون تشغيل فعلي (Code-level verification only).
- `BLOCKED`: تعذر إجراء الاختبار لعدم توفر متطلبات التشغيل أو البيئة (Test unavailable / blocked).
- `FAIL`: تم الاختبار فعلياً وفشل (Actual test failed).

⚠️ **ممنوع منعاً باتاً استخدام `PASS` لمجرد أن الكود "يبدو صحيحاً".**

## 6. المحظورات الصارمة (Strict Prohibitions)
- ❌ ممنوع إجراء GitHub push.
- ❌ ممنوع إجراء Git commit إلا بطلب صريح ومحدد من المستخدم.
- ❌ ممنوع تغيير إعدادات Cloudflare production بدون طلب صريح.
- ❌ ممنوع تغيير أسرار البيئة (Secrets).
- ❌ ممنوع طباعة الأسرار (Secrets) أو بيانات الدفع الحقيقية (Payment Data).
- ❌ ممنوع اختراع بيانات اعتماد أو مفاتيح وهمية (Credentials).
- ❌ ممنوع اختراع أي API endpoint غير موجود وموثق.
- ❌ ممنوع إعادة بناء المشروع كـ Demo.
- ❌ ممنوع الاحتفاظ بنسخ قديمة من المكونات بجانب الجديدة لمجرد تجنب حذفها (No duplicate dead components).
- ❌ لا يجوز تعديل هذا الملف (`AI_REVIEW_INSTRUCTIONS.md`) إلا بتعليمات صريحة من المستخدم.
