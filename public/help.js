// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   ❓  GBR HELP SYSTEM  —  نظام دليل المساعدة الشامل                      ║
// ║   سياقي لكل صفحة — مع بحث وتنقل بين الأقسام                              ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── محتوى المساعدة لكل صفحة ─────────────────────────────────────────────
const HELP_CONTENT = {

    dashboard: {
        title: '📊 لوحة التحكم الرئيسية',
        section: 'الرئيسية',
        color: '#1a3a5c',
        overview: 'نقطة البداية في النظام. تعرض ملخصاً شاملاً لأداء الشركة: الموردون، المدين، الدائن، الرصيد الصافي، وعدد الحركات.',
        steps: [
            { icon: '👁️', title: 'مراقبة المؤشرات', desc: 'تابع 6 مؤشرات رئيسية في الأعلى (KPIs): الموردون، المدين، الدائن، الصافي، الحركات، المستخدمون.' },
            { icon: '🔔', title: 'التنبيهات الذكية', desc: 'النظام يُنبهك تلقائياً بالإجازات المنتهية، السلف المتأخرة، وأوامر الشراء المعلقة.' },
            { icon: '📊', title: 'الرسوم البيانية', desc: 'اطّلع على توزيع المصروفات والإيرادات بشكل بصري واضح.' },
            { icon: '⚡', title: 'الوصول السريع', desc: 'استخدم أزرار "الإجراءات السريعة" للانتقال مباشرة للأقسام الأكثر استخداماً.' }
        ],
        tips: [
            'ابدأ يومك من هنا للاطلاع على أي تنبيهات مهمة.',
            'الأرقام الحمراء = مستحقات علينا، الخضراء = إيرادات.',
            'اضغط على أي مؤشر للانتقال للتفاصيل.'
        ],
        related: [{ page: 'statement', label: '📋 كشف الحساب' }, { page: 'customers', label: '🤝 العملاء' }, { page: 'prjdashboard', label: '🏗️ لوحة المشاريع' }]
    },

    // ══ المبيعات ══
    customers: {
        title: '🤝 إدارة العملاء',
        section: 'المبيعات',
        color: '#27ae60',
        overview: 'سجل كامل لجميع عملاء الشركة. كل عميل مرتبط بمشاريعه وفواتيره وسندات قبضه. الربط بالمشروع إجباري لضمان دقة المحاسبة.',
        steps: [
            { icon: '➕', title: 'إضافة عميل جديد', desc: 'اضغط "➕ عميل جديد" وأدخل: الاسم، الرقم الضريبي، السجل التجاري، شروط الدفع، الرصيد الافتتاحي.' },
            { icon: '🔗', title: 'ربط المشروع بالعميل', desc: 'عند إنشاء أي مشروع، يجب اختيار العميل المرتبط من القائمة المنسدلة — هذا إجباري.' },
            { icon: '📊', title: 'متابعة رصيد العميل', desc: 'كل فاتورة مبيعات وسند قبض تؤثر تلقائياً على رصيد العميل.' },
            { icon: '📑', title: 'عرض حساب العميل', desc: 'اضغط 👁️ بجانب أي عميل لرؤية كشف حسابه الكامل: الفواتير، المدفوعات، الرصيد.' }
        ],
        tips: [
            'أضف الرقم الضريبي للعميل — يظهر تلقائياً في فواتير المبيعات والمستخلصات.',
            'شروط الدفع (30/60/90 يوم) تُستخدم في تقرير أعمار الذمم المدينة.',
            'الرصيد الافتتاحي للعملاء القدامى قبل بدء استخدام النظام.'
        ],
        related: [{ page: 'salesinvoices', label: '🧾 فواتير المبيعات' }, { page: 'receipts', label: '💵 سندات القبض' }, { page: 'projects', label: '📁 المشاريع' }]
    },

    salesinvoices: {
        title: '🧾 فواتير المبيعات',
        section: 'المبيعات',
        color: '#27ae60',
        overview: 'إصدار وإدارة فواتير المبيعات للعملاء. كل فاتورة مرحّلة تُنشئ قيداً محاسبياً تلقائياً: مدين ذمم مدينة / دائن إيراد.',
        steps: [
            { icon: '➕', title: 'فاتورة جديدة', desc: 'اضغط "➕ فاتورة جديدة" ← اختر العميل ← أضف البنود (الوصف، الكمية، السعر، الضريبة).' },
            { icon: '💾', title: 'حفظ كمسودة', desc: 'احفظ الفاتورة كمسودة للمراجعة قبل الترحيل النهائي.' },
            { icon: '✅', title: 'ترحيل الفاتورة', desc: 'اضغط "ترحيل" — ينشئ النظام القيد المحاسبي تلقائياً ويحدّث رصيد العميل.' },
            { icon: '🔗', title: 'الربط بالمستخلصات', desc: 'المستخلصات المعتمدة تُحوَّل تلقائياً إلى فواتير مبيعات مرحّلة.' }
        ],
        tips: [
            'لا يمكن حذف فاتورة مرحّلة — استخدم "تعديل فاتورة مرحّلة" (للمدير المالي فقط).',
            'أضف ضريبة القيمة المضافة (15%) لكل بند — تُحسب تلقائياً.',
            'يمكن طباعة الفاتورة بتنسيق ZATCA الاحترافي.'
        ],
        related: [{ page: 'customers', label: '🤝 العملاء' }, { page: 'receipts', label: '💵 سندات القبض' }, { page: 'journalentries', label: '📒 قيود اليومية' }]
    },

    receipts: {
        title: '💵 سندات القبض',
        section: 'المبيعات',
        color: '#27ae60',
        overview: 'تسجيل المتحصلات من العملاء. كل سند قبض يُقلّل رصيد العميل تلقائياً وينشئ قيداً: مدين نقدية/بنك / دائن ذمم مدينة.',
        steps: [
            { icon: '➕', title: 'سند قبض جديد', desc: 'اختر العميل ← حدد الفاتورة المرتبطة ← أدخل المبلغ وطريقة الدفع (نقدي/شيك/تحويل).' },
            { icon: '🏦', title: 'حساب القبض', desc: 'اختر حساب الصندوق أو البنك الذي تحصّل إليه المبلغ من شجرة الحسابات.' },
            { icon: '📒', title: 'القيد التلقائي', desc: 'عند الحفظ يُنشأ القيد: مدين (نقدية/بنك) / دائن (ذمم مدينة العميل).' },
            { icon: '📊', title: 'متابعة التحصيل', desc: 'راجع تقرير أعمار الذمم المدينة لمعرفة المستحقات غير المحصّلة.' }
        ],
        tips: [
            'حدد رقم الشيك وتاريخ استحقاقه لمتابعة الشيكات.',
            'إذا كان الدفع جزئياً — أدخل المبلغ المحصّل فقط.',
            'مرتبط بقائمة الذمم المدينة في المستخلصات.'
        ],
        related: [{ page: 'salesinvoices', label: '🧾 فواتير المبيعات' }, { page: 'customers', label: '🤝 العملاء' }, { page: 'progressbillings', label: '📑 المستخلصات' }]
    },

    statement: {
        title: '📋 كشف الحساب',
        section: 'المبيعات',
        color: '#2d6a9f',
        overview: 'عرض شامل لجميع الحركات المالية مع الموردين والعملاء. يمكن الفلترة بالمورد والفترة والنوع.',
        steps: [
            { icon: '🔍', title: 'تحديد المورد/العميل', desc: 'اختر الجهة من القائمة أو اتركها فارغة لعرض كل الحركات.' },
            { icon: '📅', title: 'تحديد الفترة', desc: 'حدد من تاريخ / إلى تاريخ لتصفية النتائج.' },
            { icon: '⬇️', title: 'تصدير', desc: 'اضغط "تصدير PDF" لحفظ الكشف أو "طباعة" لطباعته مباشرة.' }
        ],
        tips: ['اترك حقل المورد فارغاً لعرض كشف شامل بكل الجهات.'],
        related: [{ page: 'dashboard', label: '📊 لوحة التحكم' }, { page: 'customers', label: '🤝 العملاء' }]
    },

    // ══ المشاريع ══
    prjdashboard: {
        title: '📊 لوحة تحكم المشاريع',
        section: 'المشاريع',
        color: '#2d6a9f',
        overview: 'نظرة شاملة على صحة جميع المشاريع: قيمة العقود، التكاليف الفعلية، الإيرادات المستخلَصة، الذمم المدينة، والمشاريع المتأخرة.',
        steps: [
            { icon: '📊', title: 'مراقبة KPIs', desc: 'تابع: قيمة العقود الإجمالية، الميزانية، التكلفة الفعلية، الفرق، الربح، إجمالي المستخلصات، الذمم المدينة.' },
            { icon: '📈', title: 'الرسوم البيانية', desc: '4 رسوم: مقارنة الميزانية/الفعلي، توزيع التكاليف، حالة المشاريع، التقدم.' },
            { icon: '⚠️', title: 'المشاريع المتأخرة', desc: 'يظهر عدد المشاريع التي تجاوزت موعد الانتهاء ونسبة الإنجاز.' },
            { icon: '🔗', title: 'فتح ملف المشروع', desc: 'انقر على أي مشروع في الجدول للانتقال لملفه الكامل.' }
        ],
        tips: [
            'الإيراد في اللوحة مبني على المستخلصات الفعلية وليس قيمة العقد الكاملة.',
            'الذمم المدينة = مستخلصات معتمدة ولم تُحصَّل بعد.'
        ],
        related: [{ page: 'projects', label: '📁 قائمة المشاريع' }, { page: 'progressbillings', label: '📑 المستخلصات' }, { page: 'prjreports', label: '📈 التقارير' }]
    },

    projects: {
        title: '📁 قائمة المشاريع',
        section: 'المشاريع',
        color: '#2d6a9f',
        overview: 'إدارة جميع مشاريع الشركة. كل مشروع مرتبط بعميل إجبارياً ويمكن تتبع مستخلصاته ومصروفاته وموظفيه.',
        steps: [
            { icon: '➕', title: 'مشروع جديد', desc: 'اضغط "➕ إضافة مشروع" ← أدخل البيانات الأساسية ← اختر العميل (إجباري) ← حدد قيمة العقد والتواريخ.' },
            { icon: '🤝', title: 'ربط العميل', desc: 'اختر العميل من القائمة المنسدلة. إذا لم يكن موجوداً، اضغط "➕ عميل جديد" لإضافته أولاً.' },
            { icon: '📂', title: 'فتح ملف المشروع', desc: 'اضغط "📂 الملف" بجانب أي مشروع للوصول لجميع تفاصيله: مستخلصات، مصروفات، رواتب، بنود، ملاحظات.' },
            { icon: '✏️', title: 'تعديل المشروع', desc: 'اضغط ✏️ لتعديل البيانات أو إضافة الفريق وبنود الميزانية.' }
        ],
        tips: [
            'أكمل تبويب "إعدادات المستخلصات" لتحديد نسب الاحتفاظ والضريبة والدفعة المقدمة.',
            'أضف أعضاء الفريق (مدير المشروع، مهندس الموقع) لتحسين التتبع.',
            'حالة المشروع: في التخطيط ← قيد التنفيذ ← مكتمل ← موقوف.'
        ],
        related: [{ page: 'boq', label: '📋 بنود العقود BOQ' }, { page: 'progressbillings', label: '📑 المستخلصات' }, { page: 'customers', label: '🤝 العملاء' }]
    },

    projectdetail: {
        title: '📂 ملف المشروع',
        section: 'المشاريع',
        color: '#2d6a9f',
        overview: 'ملف شامل للمشروع في مكان واحد: المعلومات، العقد، البنود، المستخلصات، المصروفات، الرواتب، والملاحظات.',
        steps: [
            { icon: '📊', title: 'نظرة عامة', desc: 'مؤشرات المشروع الرئيسية: قيمة العقد، المستخلَص، المصروفات، الرصيد، نسبة الإنجاز.' },
            { icon: '📋', title: 'العقد والبنود', desc: 'أضف بنود BOQ وتابع نسبة الإنجاز لكل بند مقارنة بالمستخلصات.' },
            { icon: '📑', title: 'المستخلصات', desc: 'أنشئ مستخلصات جديدة بنفس تصميم الصفحة الرئيسية — مع تحويل تلقائي لفاتورة وقيد.' },
            { icon: '💸', title: 'المصروفات', desc: 'سجّل المصروفات المباشرة للمشروع (مواد، عمالة، معدات، خدمات) وتابع التكاليف.' },
            { icon: '📝', title: 'الملاحظات', desc: 'سجّل مستجدات المشروع: قرارات، مشاكل، مخاطر.' }
        ],
        tips: [
            'استخدم تبويب "الرواتب" لمعرفة التكلفة الفعلية للموظفين على المشروع.',
            'المصروفات + المشتريات = إجمالي تكلفة المشروع الفعلية.'
        ],
        related: [{ page: 'boq', label: '📋 BOQ' }, { page: 'progressbillings', label: '📑 المستخلصات' }, { page: 'projectcosts', label: '💰 التكاليف' }]
    },

    boq: {
        title: '📋 بنود العقود (BOQ)',
        section: 'المشاريع',
        color: '#2d6a9f',
        overview: 'Bill of Quantities — جدول كميات العقد. أساس إنشاء المستخلصات. كل بند له وصف، وحدة، كمية، وسعر وحدة.',
        steps: [
            { icon: '📁', title: 'اختر المشروع', desc: 'اختر المشروع من القائمة المنسدلة لعرض بنوده أو إضافة بنود جديدة.' },
            { icon: '➕', title: 'إضافة بند', desc: 'أدخل: رقم البند، الوصف، الوحدة، الكمية، سعر الوحدة — المجموع يُحسب تلقائياً.' },
            { icon: '📤', title: 'استيراد Excel', desc: 'لديك BOQ في Excel؟ استخدم زر "استيراد من Excel" لرفع جميع البنود دفعة واحدة.' },
            { icon: '📑', title: 'إنشاء مستخلص', desc: 'بعد إضافة البنود، انتقل لصفحة المستخلصات وأنشئ IPC — ستُجلب البنود تلقائياً.' }
        ],
        tips: [
            'مجموع BOQ يجب أن يساوي قيمة العقد — النظام يُنبهك إذا كان هناك فرق.',
            'رقم البند (1.1، 1.2...) يساعد في تنظيم التقارير.',
            'يمكن تقسيم البنود لأقسام (Main Contract, VO#01...).'
        ],
        related: [{ page: 'progressbillings', label: '📑 المستخلصات' }, { page: 'projects', label: '📁 المشاريع' }]
    },

    progressbillings: {
        title: '📑 المستخلصات (IPC)',
        section: 'المشاريع',
        color: '#2d6a9f',
        overview: 'Interim Payment Certificates — نظام المستخلصات الدورية. كل مستخلص معتمد يُحوَّل تلقائياً لفاتورة مبيعات وقيد محاسبي.',
        steps: [
            { icon: '➕', title: 'مستخلص جديد', desc: 'اضغط "➕ مستخلص جديد" ← اختر المشروع (يجب أن يحتوي على بنود BOQ) ← أدخل التاريخ والفترة.' },
            { icon: '✍️', title: 'إدخال الكميات', desc: 'في جدول IPC، أدخل الكميات الحالية لكل بند. يُحسب المبلغ تلقائياً. رقم البند (إن لم يكن مُسجَّلاً في بند BOQ) يُعرض تلقائياً كترتيب البند داخل الجدول.' },
            { icon: '⚙️', title: 'الاستقطاعات', desc: 'عدّل نسب: الاحتفاظ، الدفعة المقدمة، الاسترداد، الضريبة — مباشرة من داخل نموذج IPC.' },
            { icon: '🔍', title: 'البحث والترتيب', desc: 'في تبويب "المستخلصات" داخل ملف المشروع، استخدم مربع البحث للوصول لمستخلص برقمه أو حالته أو تاريخه بسرعة. القائمة مرتّبة تلقائياً بحيث تظهر المستخلصات "المُقدَّمة للاعتماد" والمسوّدات أولاً لتسهيل اعتمادها، ثم البقية بحسب الأحدث.' },
            { icon: '📤', title: 'إرسال للاعتماد', desc: 'اضغط "📤 إرسال للاعتماد" — يتحوّل المستخلص لحالة "مُقدَّم للعميل" ويُنشأ رابط اعتماد يمكن مشاركته مع مدير المشروع/العميل.' },
            { icon: '✅', title: 'الاعتماد أو الرفض', desc: 'عند الاعتماد أو الرفض تظهر نافذة "قرار الاعتماد" لتسجيل ملاحظة (أو سبب الرفض). يُحفظ هذا القرار كنسخة داخل المستخلص نفسه ويظهر بوضوح لمن يفتحه — بمن فيهم مدير المشروع عبر رابط الاعتماد. الاعتماد ينشئ فاتورة مبيعات + قيد اعتماد تلقائياً، والرفض يعيد المستخلص "مسودة" لتعديله وإعادة إرساله.' },
            { icon: '💵', title: 'التحصيل', desc: 'عند الدفع: غيّر الحالة لـ "مدفوع" ← أنشئ قيد التحصيل من البطاقة.' }
        ],
        tips: [
            'لا يمكن حفظ مستخلص بمبلغ صفر — أدخل كميات فعلية أولاً.',
            'استخدم رابط الاعتماد لمشاركة المستخلص مع العميل أو مدير المشروع.',
            'دوّن سبب الرفض دائماً عند رفض مستخلص — يظهر للمُرسِل كي يعرف ما يحتاج تعديله بالضبط.',
            'تقرير أعمار الذمم المدينة يظهر المستخلصات غير المحصّلة.',
            'إلغاء مستخلص معتمد للمدير ومدير المشاريع فقط — يلغي الفاتورة والقيود.'
        ],
        related: [{ page: 'boq', label: '📋 BOQ' }, { page: 'salesinvoices', label: '🧾 الفواتير' }, { page: 'journalentries', label: '📒 القيود' }]
    },

    projectcosts: {
        title: '💰 تكاليف المشاريع الشهرية',
        section: 'المشاريع',
        color: '#e67e22',
        overview: 'إدخال يدوي للتكاليف الشهرية لكل مشروع: مواد، أجور، معدات، مقاولون فرعيون. يُستخدم في تحليل الربحية.',
        steps: [
            { icon: '📁', title: 'اختر المشروع', desc: 'اختر المشروع والشهر ← أدخل التكاليف حسب الفئة.' },
            { icon: '💰', title: 'أدخل التكاليف', desc: 'المواد، العمالة، المعدات، المقاولون الفرعيون، الغير مباشرة.' },
            { icon: '📊', title: 'متابعة الربحية', desc: 'تنعكس هذه التكاليف في لوحة تحكم المشاريع وتقارير الربحية.' }
        ],
        tips: ['استخدم هذه الصفحة للتكاليف التي لا تُسجَّل عبر أوامر الشراء أو الرواتب.'],
        related: [{ page: 'prjdashboard', label: '📊 لوحة المشاريع' }, { page: 'prjreports', label: '📈 التقارير' }]
    },

    prjreports: {
        title: '📈 التقارير المالية للمشاريع',
        section: 'المشاريع',
        color: '#8e44ad',
        overview: 'مركز التقارير التحليلية للمشاريع: 20+ تقرير يغطي كل جانب من جوانب الأداء المالي.',
        steps: [
            { icon: '📊', title: 'اختر التقرير', desc: 'اضغط على أي تقرير من القائمة: التدفقات النقدية، الربحية، الانحرافات، EVM...' },
            { icon: '🔍', title: 'فلتر المشروع', desc: 'اختر مشروعاً محدداً أو اتركه "كل المشاريع" للتقارير الإجمالية.' },
            { icon: '📅', title: 'الفترة الزمنية', desc: 'حدد من/إلى لتقييد التقرير بفترة معينة.' },
            { icon: '📤', title: 'تصدير', desc: 'يمكن طباعة أي تقرير أو تصديره.' }
        ],
        tips: [
            'تقرير EVM (Earned Value Management) هو الأدق لقياس صحة المشروع.',
            'تقرير التدفقات النقدية يستخدم تواريخ المستخلصات الفعلية — ليس تقديرات.',
            'تقرير الربحية يحسب الإيراد من المستخلصات المعتمدة.'
        ],
        related: [{ page: 'prjdashboard', label: '📊 لوحة المشاريع' }, { page: 'progressbillings', label: '📑 المستخلصات' }]
    },

    // ══ المشتريات ══
    matrequests: {
        title: '📨 طلبات المواد',
        section: 'المشتريات',
        color: '#e67e22',
        overview: 'مرحلة أولى في دورة الشراء. يرفع مهندس الموقع أو المشرف طلب مواد ← يوافق المدير ← يتحوّل لعرض أسعار أو أمر شراء.',
        steps: [
            { icon: '➕', title: 'طلب جديد', desc: 'اضغط "طلب جديد" ← اختر المشروع ← أضف المواد المطلوبة من الكتالوج.' },
            { icon: '🔍', title: 'مراجعة الطلب', desc: 'المدير يراجع الطلب ويوافق على الكميات والأسعار.' },
            { icon: '✅', title: 'الموافقة', desc: 'بعد الموافقة يمكن تحويل الطلب لعرض أسعار أو أمر شراء مباشر.' }
        ],
        tips: ['الطلبات الموافق عليها تُحتسب في تكاليف المشروع.'],
        related: [{ page: 'quotations', label: '💼 عروض الأسعار' }, { page: 'purchaseorders', label: '📄 أوامر الشراء' }, { page: 'materials', label: '📦 كتالوج المواد' }]
    },

    quotations: {
        title: '💼 عروض الأسعار',
        section: 'المشتريات',
        color: '#e67e22',
        overview: 'طلب عروض أسعار من الموردين ومقارنتها لاختيار الأفضل. مرحلة بين طلب المواد وأمر الشراء.',
        steps: [
            { icon: '➕', title: 'طلب عرض سعر', desc: 'أنشئ عرض سعر وأرفق المواد المطلوبة ← أرسل للموردين المختلفين.' },
            { icon: '📊', title: 'مقارنة العروض', desc: 'يعرض النظام جدول مقارنة الأسعار من مختلف الموردين لاختيار الأفضل.' },
            { icon: '✅', title: 'الاعتماد والتحويل', desc: 'اعتمد العرض الأفضل ← حوّله لأمر شراء بضغطة واحدة.' }
        ],
        tips: ['احتفظ بعروض الأسعار القديمة — مرجع مفيد للتسعير مستقبلاً.'],
        related: [{ page: 'purchaseorders', label: '📄 أوامر الشراء' }, { page: 'suppliers', label: '🏢 الموردون' }]
    },

    purchaseorders: {
        title: '📄 أوامر الشراء',
        section: 'المشتريات',
        color: '#e67e22',
        overview: 'أوامر الشراء الرسمية للموردين. مرتبطة بالمشروع والمورد. بعد الاستلام تُسجَّل في GRN.',
        steps: [
            { icon: '➕', title: 'أمر جديد', desc: 'اختر المورد والمشروع ← أضف المواد والكميات والأسعار.' },
            { icon: '✅', title: 'اعتماد الأمر', desc: 'المدير يعتمد الأمر قبل إرساله للمورد.' },
            { icon: '📥', title: 'الاستلام', desc: 'بعد وصول البضاعة، أنشئ GRN (استلام بضاعة) مرتبطاً بهذا الأمر.' }
        ],
        tips: [
            'أوامر الشراء المعتمدة تُحتسب في تكاليف المشروع.',
            'يمكن استلام البضاعة على دفعات جزئية.'
        ],
        related: [{ page: 'grn', label: '📥 استلام البضاعة' }, { page: 'invoices', label: '🧾 فواتير الموردين' }, { page: 'suppliers', label: '🏢 الموردون' }]
    },

    grn: {
        title: '📥 استلام البضاعة (GRN)',
        section: 'المشتريات',
        color: '#e67e22',
        overview: 'Goods Receipt Note — تأكيد استلام البضاعة من المورد. يُستخدم لمطابقة الفاتورة لاحقاً.',
        steps: [
            { icon: '📄', title: 'اختر أمر الشراء', desc: 'حدد أمر الشراء المرتبط بهذا الاستلام.' },
            { icon: '✍️', title: 'أدخل الكميات المستلمة', desc: 'قارن المطلوب بالمستلم — يمكن الاستلام الجزئي.' },
            { icon: '✅', title: 'تأكيد الاستلام', desc: 'احفظ GRN ← يصبح جاهزاً لمطابقة الفاتورة.' }
        ],
        tips: ['سجّل أي ملاحظات على جودة البضاعة في حقل الملاحظات.'],
        related: [{ page: 'purchaseorders', label: '📄 أوامر الشراء' }, { page: 'invoices', label: '🧾 فواتير الموردين' }]
    },

    invoices: {
        title: '🧾 فواتير الموردين',
        section: 'المشتريات',
        color: '#e67e22',
        overview: 'تسجيل فواتير الموردين ومطابقتها مع GRN. ثلاثية المطابقة: أمر شراء + استلام بضاعة + فاتورة.',
        steps: [
            { icon: '➕', title: 'فاتورة جديدة', desc: 'اختر المورد ← اربطها بـ GRN مناسب ← أدخل بيانات الفاتورة.' },
            { icon: '🔍', title: 'المطابقة الثلاثية', desc: 'النظام يتحقق من تطابق الكميات والأسعار مع أمر الشراء واستلام البضاعة.' },
            { icon: '✅', title: 'الاعتماد', desc: 'اعتمد الفاتورة للموافقة على الصرف.' }
        ],
        tips: ['ربط الفاتورة بـ GRN يمنع ازدواجية الدفع.'],
        related: [{ page: 'grn', label: '📥 GRN' }, { page: 'payments', label: '💸 سندات الصرف' }, { page: 'purchaseinvoices', label: '📋 فواتير المشتريات (محاسبي)' }]
    },

    suppliers: {
        title: '🏢 قائمة الموردين',
        section: 'المشتريات',
        color: '#e67e22',
        overview: 'سجل كامل للموردين: بيانات التواصل، شروط الدفع، رصيد الحساب، وتاريخ التعاملات.',
        steps: [
            { icon: '➕', title: 'مورد جديد', desc: 'أضف: الاسم، السجل التجاري، الرقم الضريبي، البنك، شروط الدفع.' },
            { icon: '📊', title: 'كشف الحساب', desc: 'اضغط 👁️ لعرض كشف حساب المورد الكامل.' }
        ],
        tips: ['أضف الرقم الضريبي للمورد — يظهر في فواتير المشتريات.'],
        related: [{ page: 'purchaseorders', label: '📄 أوامر الشراء' }, { page: 'invoices', label: '🧾 الفواتير' }, { page: 'suppliers_catalog', label: '🏭 الكتالوج' }]
    },

    // ══ الموارد البشرية ══
    hrdashboard: {
        title: '📊 لوحة تحكم HR',
        section: 'الموارد البشرية',
        color: '#16a085',
        overview: 'ملخص شامل للموارد البشرية: إجمالي الموظفين، تكاليف الرواتب، معدل الحضور، الإجازات المعلقة.',
        steps: [
            { icon: '👀', title: 'مؤشرات الأداء', desc: 'الموظفون النشطون، إجمالي تكلفة الرواتب، متوسط الراتب، معدل الحضور الشهري.' },
            { icon: '⚠️', title: 'التنبيهات', desc: 'وثائق منتهية الصلاحية، إجازات معلقة، موظفون بدون راتب.' }
        ],
        tips: ['تحقق من هذه اللوحة يومياً لمعرفة أي متطلبات عاجلة.'],
        related: [{ page: 'employees', label: '📇 الموظفون' }, { page: 'payroll', label: '💵 مسير الرواتب' }, { page: 'attendance', label: '🕐 الحضور' }]
    },

    employees: {
        title: '📇 الموظفون',
        section: 'الموارد البشرية',
        color: '#16a085',
        overview: 'ملف كامل لكل موظف: بيانات شخصية، راتب، بدلات، خصومات، مستندات، إجازات، سلف، تقييمات — كل شيء في 10 تبويبات.',
        steps: [
            { icon: '➕', title: 'موظف جديد', desc: 'اضغط "➕ إضافة موظف" ← أدخل البيانات الشخصية ← الراتب والبدلات ← التبعية (إدارة أو مشروع).' },
            { icon: '💰', title: 'تبويب الراتب', desc: 'أدخل: الراتب الأساسي، بدل السكن، المواصلات، الاتصالات ← الملخص يُحسب تلقائياً.' },
            { icon: '📎', title: 'المستندات', desc: 'ارفع: جواز السفر، الإقامة، عقد العمل ← النظام يُنبهك قبل الانتهاء بـ 30 يوم.' },
            { icon: '🔗', title: 'ربط بالمشروع', desc: 'في تبويب البيانات الشخصية: اختر "تابع لمشروع" وحدد المشروع من القائمة.' }
        ],
        tips: [
            'بعد إضافة الراتب يصبح الموظف جاهزاً في مسير الرواتب.',
            'رقم الإقامة + تاريخ الانتهاء ← تنبيه تلقائي قبل الانتهاء.'
        ],
        related: [{ page: 'payroll', label: '💵 مسير الرواتب' }, { page: 'attendance', label: '🕐 الحضور' }, { page: 'leaves', label: '🌴 الإجازات' }]
    },

    payroll: {
        title: '💵 مسير الرواتب',
        section: 'الموارد البشرية',
        color: '#16a085',
        overview: 'إنشاء مسيرات الرواتب الشهرية لجميع الموظفين أو لمشاريع محددة. مع قيد محاسبي تلقائي وسند صرف.',
        steps: [
            { icon: '🗓️', title: 'اختر الشهر', desc: 'حدد الشهر والسنة ← اختر نطاق الموظفين (الكل / مشروع / إدارة).' },
            { icon: '➕', title: 'إنشاء المسير', desc: 'اضغط "إنشاء المسير" ← يُحسب الراتب الصافي لكل موظف تلقائياً.' },
            { icon: '✅', title: 'اعتماد المسير', desc: 'راجع الأرقام ← اعتمد المسير ← ينشئ قيداً محاسبياً تلقائياً.' },
            { icon: '💳', title: 'الدفع', desc: 'سدّد المسير ← ينشئ النظام سند صرف + قيد دفع تلقائياً.' }
        ],
        tips: [
            'الخصومات الشهرية (سلف، غياب، تأخير) تُطرح تلقائياً من الراتب.',
            'يمكن تصدير المسير لملف Excel للبنك.'
        ],
        related: [{ page: 'employees', label: '📇 الموظفون' }, { page: 'attendance', label: '🕐 الحضور' }, { page: 'loans', label: '💳 السلف' }]
    },

    attendance: {
        title: '🕐 الحضور والانصراف',
        section: 'الموارد البشرية',
        color: '#16a085',
        overview: 'تسجيل ومتابعة الحضور اليومي للموظفين. ربط الغياب بخصومات الراتب التلقائية.',
        steps: [
            { icon: '✅', title: 'تسجيل الحضور', desc: 'اختر الموظف ← أدخل وقت الدخول والخروج ← احسب الساعات تلقائياً.' },
            { icon: '🔍', title: 'البحث المتقدم', desc: 'ابحث عن موظف محدد بنطاق تاريخي لعرض كل سجلاته.' },
            { icon: '💰', title: 'تقرير الراتب', desc: 'اضغط "💰 تقرير الراتب" لحساب الراتب المستحق بعد خصم الغياب.' }
        ],
        tips: ['الراتب اليومي = الراتب الشهري ÷ 26 يوم عمل.'],
        related: [{ page: 'payroll', label: '💵 مسير الرواتب' }, { page: 'employees', label: '📇 الموظفون' }]
    },

    leaves: {
        title: '🌴 طلبات الإجازات',
        section: 'الموارد البشرية',
        color: '#16a085',
        overview: 'نظام طلبات الإجازات: اعتماد، رفض، تتبع الرصيد.',
        steps: [
            { icon: '➕', title: 'طلب إجازة', desc: 'اختر الموظف ← نوع الإجازة ← التاريخ من/إلى ← ارفع المستندات إن لزم.' },
            { icon: '✅', title: 'الاعتماد/الرفض', desc: 'المدير يراجع الطلب ويعتمده أو يرفضه مع إرفاق السبب.' }
        ],
        tips: ['إجازة المرض تحتاج شهادة طبية.', 'الإجازة السنوية مرتبطة بسنوات الخدمة.'],
        related: [{ page: 'employees', label: '📇 الموظفون' }, { page: 'attendance', label: '🕐 الحضور' }]
    },

    loans: {
        title: '💳 السلف والقروض',
        section: 'الموارد البشرية',
        color: '#16a085',
        overview: 'إدارة سلف الموظفين مع أقساط شهرية تُخصم تلقائياً من مسير الرواتب.',
        steps: [
            { icon: '➕', title: 'سلفة جديدة', desc: 'اختر الموظف ← المبلغ ← عدد الأقساط ← النظام يحسب القسط الشهري.' },
            { icon: '✅', title: 'اعتماد السلفة', desc: 'يعتمد المدير السلفة ← تبدأ الخصومات من الشهر التالي تلقائياً.' }
        ],
        tips: ['القسط يُخصم تلقائياً من مسير الرواتب دون تدخل يدوي.'],
        related: [{ page: 'payroll', label: '💵 مسير الرواتب' }, { page: 'employees', label: '📇 الموظفون' }]
    },

    // ══ المحاسبة ══
    accdashboard: {
        title: '📊 لوحة المحاسبة',
        section: 'المحاسبة',
        color: '#8e44ad',
        overview: 'مركز قيادة المحاسبة: ملخص الإيرادات والمصروفات، الذمم المدينة والدائنة، ميزان الحسابات.',
        steps: [
            { icon: '👀', title: 'المؤشرات المالية', desc: 'إيرادات vs مصروفات، الربح الإجمالي، الذمم المدينة والدائنة.' },
            { icon: '📊', title: 'ميزان المراجعة', desc: 'تحقق من توازن الحسابات — المجموع المدين = المجموع الدائن دائماً.' }
        ],
        tips: ['ابدأ بإعداد شجرة الحسابات قبل ترحيل أي قيود.'],
        related: [{ page: 'chartofaccounts', label: '🌳 شجرة الحسابات' }, { page: 'journalentries', label: '📒 قيود اليومية' }, { page: 'trialbalance', label: '⚖️ ميزان المراجعة' }]
    },

    chartofaccounts: {
        title: '🌳 شجرة الحسابات',
        section: 'المحاسبة',
        color: '#8e44ad',
        overview: 'الهيكل الأساسي للمحاسبة. 5 أنواع: الأصول (1xxx)، الخصوم (2xxx)، حقوق الملكية (3xxx)، الإيرادات (4xxx)، المصروفات (5xxx).',
        steps: [
            { icon: '🌳', title: 'فهم الهيكل', desc: 'الحسابات الرئيسية (header) ← الحسابات التفصيلية (detail) — القيود تُسجَّل على التفصيلية فقط.' },
            { icon: '➕', title: 'حساب جديد', desc: 'حدد: الكود، الاسم، النوع، الطبيعة (رئيسي/تفصيلي)، الحساب الأب.' },
            { icon: '📒', title: 'استخدام في القيود', desc: 'بعد إضافة الحسابات، استخدمها في قيود اليومية.' }
        ],
        tips: [
            '1130 = ذمم مدينة العملاء، 2140 = ضريبة القيمة المضافة، 4100 = الإيرادات.',
            'لا تحذف حسابات لها قيود مرتبطة.'
        ],
        related: [{ page: 'journalentries', label: '📒 قيود اليومية' }, { page: 'generalledger', label: '📖 دفتر الأستاذ' }]
    },

    journalentries: {
        title: '📒 قيود اليومية',
        section: 'المحاسبة',
        color: '#8e44ad',
        overview: 'قلب نظام المحاسبة. كل عملية مالية تُسجَّل كقيد مزدوج: مجموع المدين = مجموع الدائن دائماً.',
        steps: [
            { icon: '➕', title: 'قيد جديد', desc: 'اضغط "قيد جديد" ← أدخل التاريخ والبيان ← أضف الأسطر (حساب مدين + حساب دائن).' },
            { icon: '⚖️', title: 'التوازن', desc: 'تأكد من تساوي المدين والدائن — النظام لا يسمح بحفظ قيد غير متوازن.' },
            { icon: '✅', title: 'الترحيل', desc: 'اضغط "ترحيل" لجعل القيد نهائياً — يؤثر على أرصدة الحسابات.' }
        ],
        tips: [
            'معظم القيود تُنشأ تلقائياً: الفواتير، المستخلصات، الرواتب، سندات القبض/الصرف.',
            'القيود المرحّلة لا تُحذف — يمكن إلغاؤها فقط مع قيد عكسي.'
        ],
        related: [{ page: 'generalledger', label: '📖 دفتر الأستاذ' }, { page: 'trialbalance', label: '⚖️ ميزان المراجعة' }]
    },

    generalledger: {
        title: '📖 دفتر الأستاذ',
        section: 'المحاسبة',
        color: '#8e44ad',
        overview: 'عرض كل حركات حساب معين مع أرصدته الجارية. استعلام قوي لتتبع تاريخ أي حساب.',
        steps: [
            { icon: '🔍', title: 'اختر الحساب', desc: 'اختر الحساب من شجرة الحسابات وحدد الفترة الزمنية.' },
            { icon: '📊', title: 'تحليل الحركات', desc: 'كل قيد يُعرض مع: التاريخ، البيان، المدين، الدائن، الرصيد الجاري.' }
        ],
        tips: ['استخدمه لمراجعة حساب ذمم العملاء (1130) أو ضريبة القيمة المضافة (2140).'],
        related: [{ page: 'journalentries', label: '📒 قيود اليومية' }, { page: 'trialbalance', label: '⚖️ ميزان المراجعة' }]
    },

    trialbalance: {
        title: '⚖️ ميزان المراجعة',
        section: 'المحاسبة',
        color: '#8e44ad',
        overview: 'قائمة بجميع أرصدة الحسابات. إجمالي المدين = إجمالي الدائن — يثبت صحة القيود.',
        steps: [
            { icon: '📊', title: 'فحص التوازن', desc: 'تحقق من أن إجمالي المدين = إجمالي الدائن لجميع الحسابات.' },
            { icon: '🔍', title: 'تحليل الانحرافات', desc: 'أي اختلاف يدل على قيد غير مكتمل — ابحث عنه في قيود اليومية.' }
        ],
        tips: ['افحص ميزان المراجعة شهرياً لضمان دقة البيانات.'],
        related: [{ page: 'journalentries', label: '📒 قيود اليومية' }, { page: 'generalledger', label: '📖 دفتر الأستاذ' }]
    },

    // ══ المخزون ══
    inventory: {
        title: '📦 المخزون والأصناف',
        section: 'المخزون',
        color: '#1a5276',
        overview: 'كتالوج الأصناف مع تتبع الكميات والأرصدة. كل صنف مرتبط بحركاته الداخلة والخارجة.',
        steps: [
            { icon: '➕', title: 'صنف جديد', desc: 'أدخل: الكود، الاسم، الوحدة، الرصيد الافتتاحي، الحد الأدنى للتنبيه.' },
            { icon: '📊', title: 'متابعة الرصيد', desc: 'الرصيد يتحدث تلقائياً من حركات الاستلام (GRN) والصرف.' },
            { icon: '⚠️', title: 'تنبيه نفاد المخزون', desc: 'النظام يُنبه عند وصول الرصيد للحد الأدنى المحدد.' }
        ],
        tips: ['الربط بـ GRN يُحدّث الرصيد تلقائياً دون إدخال يدوي.'],
        related: [{ page: 'inventorymovements', label: '📋 الحركات' }, { page: 'inventoryreports', label: '📊 التقارير' }, { page: 'grn', label: '📥 GRN' }]
    },

    inventorymovements: {
        title: '📋 حركات المخزون',
        section: 'المخزون',
        color: '#1a5276',
        overview: 'سجل كامل لكل دخول وخروج للمخزون مع الأرصدة الجارية لكل صنف.',
        steps: [
            { icon: '🔍', title: 'بحث الحركات', desc: 'فلتر بالصنف، الفترة، نوع الحركة (دخول/خروج/تحويل).' },
            { icon: '📊', title: 'تحليل الحركات', desc: 'تابع الرصيد الجاري بعد كل حركة.' }
        ],
        tips: ['الحركات التلقائية (من GRN) أكثر دقة من الحركات اليدوية.'],
        related: [{ page: 'inventory', label: '📦 الأصناف' }, { page: 'inventoryreports', label: '📊 التقارير' }]
    },

    inventoryreports: {
        title: '📊 تقارير المخزون',
        section: 'المخزون',
        color: '#1a5276',
        overview: 'تقارير احترافية: الأرصدة الحالية، تحت الحد الأدنى، تقييم المخزون.',
        steps: [
            { icon: '📊', title: 'تقرير الأرصدة', desc: 'قائمة بكل الأصناف وأرصدتها الحالية وقيمتها.' },
            { icon: '⚠️', title: 'تقرير النفاد', desc: 'الأصناف التي وصلت للحد الأدنى وتحتاج إعادة طلب.' }
        ],
        tips: ['استخدم تقرير التقييم للميزانية العمومية.'],
        related: [{ page: 'inventory', label: '📦 الأصناف' }, { page: 'inventorymovements', label: '📋 الحركات' }]
    },

    settings: {
        title: '⚙️ الإعدادات',
        section: 'الإدارة',
        color: '#7f8c8d',
        overview: 'إعدادات النظام العامة: بيانات الشركة، الرقم الضريبي، العملة، التوقيت، الشعار.',
        steps: [
            { icon: '🏢', title: 'بيانات الشركة', desc: 'اسم الشركة، الرقم الضريبي، السجل التجاري، العنوان — تظهر في كل التقارير والفواتير.' },
            { icon: '💱', title: 'العملة', desc: 'حدد العملة الافتراضية للنظام.' }
        ],
        tips: ['أكمل بيانات الشركة أولاً — تظهر في فواتير ZATCA والمستخلصات.'],
        related: [{ page: 'users', label: '👥 المستخدمون' }]
    },

    users: {
        title: '👥 المستخدمون',
        section: 'الإدارة',
        color: '#7f8c8d',
        overview: 'إدارة حسابات المستخدمين وصلاحياتهم. الأدوار: مدير، محاسب، مدير مشاريع، مهندس موقع، مشاهد...',
        steps: [
            { icon: '➕', title: 'مستخدم جديد', desc: 'أدخل الاسم والبريد وكلمة المرور ← اختر الدور الوظيفي.' },
            { icon: '🔐', title: 'الصلاحيات', desc: 'كل دور له صلاحيات محددة — يمكن تخصيص الصلاحيات يدوياً.' }
        ],
        tips: ['مدير النظام له صلاحية كاملة. لا تمنح صلاحيات أكثر من اللازم.'],
        related: [{ page: 'settings', label: '⚙️ الإعدادات' }]
    }
};

// ── إنشاء واجهة المساعدة ─────────────────────────────────────────────────
(function initHelpSystem() {

    // زر المساعدة العائم
    const helpBtn = document.createElement('button');
    helpBtn.id = 'helpFloatBtn';
    helpBtn.innerHTML = '❓';
    helpBtn.title = 'دليل الاستخدام';
    helpBtn.style.cssText = `
        position:fixed;left:20px;bottom:80px;width:46px;height:46px;border-radius:50%;
        background:linear-gradient(135deg,#2d6a9f,#1a3a5c);color:white;border:none;
        font-size:20px;cursor:pointer;z-index:9990;box-shadow:0 4px 16px rgba(0,0,0,.25);
        transition:transform .2s,box-shadow .2s;display:flex;align-items:center;justify-content:center;
    `;
    helpBtn.onmouseenter = () => { helpBtn.style.transform = 'scale(1.1)'; helpBtn.style.boxShadow = '0 6px 22px rgba(0,0,0,.35)'; };
    helpBtn.onmouseleave = () => { helpBtn.style.transform = ''; helpBtn.style.boxShadow = '0 4px 16px rgba(0,0,0,.25)'; };
    helpBtn.onclick = () => window.toggleHelpPanel?.();
    document.body.appendChild(helpBtn);

    // لوحة المساعدة
    const panel = document.createElement('div');
    panel.id = 'helpPanel';
    panel.style.cssText = `
        position:fixed;left:0;top:0;bottom:0;width:400px;max-width:95vw;
        background:white;z-index:9991;box-shadow:4px 0 30px rgba(0,0,0,.2);
        display:flex;flex-direction:column;transform:translateX(-100%);
        transition:transform .3s cubic-bezier(.4,0,.2,1);border-left:none;
        font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;
    `;
    panel.innerHTML = `
        <!-- رأس اللوحة -->
        <div style="background:linear-gradient(135deg,#1a3a5c,#2d6a9f);color:white;padding:16px;flex-shrink:0">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <div style="font-size:16px;font-weight:800">❓ دليل الاستخدام</div>
                <button onclick="toggleHelpPanel()" style="background:rgba(255,255,255,.2);border:none;color:white;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">✕</button>
            </div>
            <input id="helpSearch" type="text" placeholder="🔍 ابحث في الدليل..." oninput="helpSearch(this.value)"
                style="width:100%;padding:8px 12px;border:none;border-radius:8px;font-size:13px;font-family:inherit;background:rgba(255,255,255,.95);color:#333;box-sizing:border-box">
        </div>

        <!-- محتوى الصفحة الحالية -->
        <div id="helpContent" style="flex:1;overflow-y:auto;padding:0">
            <div style="padding:60px 20px;text-align:center;color:#999">
                <div style="font-size:48px;margin-bottom:12px">📖</div>
                <div style="font-size:14px">انتقل لأي صفحة لعرض دليلها</div>
            </div>
        </div>

        <!-- نتائج البحث -->
        <div id="helpSearchResults" style="display:none;flex:1;overflow-y:auto;padding:12px"></div>

        <!-- تذييل: قائمة الأقسام -->
        <div style="border-top:2px solid #f0f0f0;padding:12px;flex-shrink:0;background:#fafafa">
            <div style="font-size:10px;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">كل الأقسام</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px" id="helpSectionLinks"></div>
        </div>
    `;
    document.body.appendChild(panel);

    // بناء أزرار الأقسام
    const sectionColors = {
        'الرئيسية': '#1a3a5c', 'المبيعات': '#27ae60', 'المشاريع': '#2d6a9f',
        'المشتريات': '#e67e22', 'الموارد البشرية': '#16a085',
        'المحاسبة': '#8e44ad', 'المخزون': '#1a5276', 'الإدارة': '#7f8c8d'
    };
    const sections = {};
    Object.entries(HELP_CONTENT).forEach(([page, h]) => {
        if (!sections[h.section]) sections[h.section] = [];
        sections[h.section].push({ page, title: h.title });
    });

    const linksEl = document.getElementById('helpSectionLinks');
    Object.entries(sections).forEach(([sec, pages]) => {
        const color = sectionColors[sec] || '#555';
        const btn = document.createElement('button');
        btn.textContent = sec;
        btn.style.cssText = `background:${color}18;color:${color};border:1.5px solid ${color}40;border-radius:6px;padding:3px 8px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:600`;
        btn.onclick = () => showHelpSection(sec, pages, color);
        linksEl.appendChild(btn);
    });

    window.toggleHelpPanel = function () {
        const p = document.getElementById('helpPanel');
        const isOpen = p.style.transform === 'translateX(0%)';
        p.style.transform = isOpen ? 'translateX(-100%)' : 'translateX(0%)';
        if (!isOpen) {
            const curPage = document.querySelector('.pg.act')?.id?.replace('pg-', '');
            if (curPage) showHelpPage(curPage);
        }
    };

    window.showHelpPage = function (page) {
        const h = HELP_CONTENT[page];
        const content = document.getElementById('helpContent');
        const searchRes = document.getElementById('helpSearchResults');
        if (searchRes) searchRes.style.display = 'none';
        if (content) content.style.display = '';
        if (!h || !content) {
            if (content) content.innerHTML = `<div style="padding:30px;text-align:center;color:#aaa"><div style="font-size:40px;margin-bottom:10px">📄</div><p>لا يوجد دليل محدد لهذه الصفحة بعد.</p></div>`;
            return;
        }
        content.innerHTML = buildHelpHTML(h);
    };

    window.showHelpSection = function (sec, pages, color) {
        const content = document.getElementById('helpContent');
        const searchRes = document.getElementById('helpSearchResults');
        if (searchRes) searchRes.style.display = 'none';
        if (!content) return;
        content.style.display = '';
        content.innerHTML = `
            <div style="padding:14px;border-bottom:2px solid ${color}30;background:${color}08">
                <div style="font-size:14px;font-weight:800;color:${color}">${sec}</div>
            </div>
            <div style="padding:10px">
                ${pages.map(p => `
                <button onclick="showHelpPage('${p.page}')" style="width:100%;text-align:right;background:white;border:1.5px solid #e0e8f0;border-radius:8px;padding:10px 14px;margin-bottom:6px;cursor:pointer;font-family:inherit;font-size:13px;color:#1a3a5c;font-weight:600;transition:all .15s"
                    onmouseover="this.style.background='${color}10';this.style.borderColor='${color}'" onmouseout="this.style.background='white';this.style.borderColor='#e0e8f0'">
                    ${p.title}
                </button>`).join('')}
            </div>`;
    };

    window.helpSearch = function (query) {
        const content = document.getElementById('helpContent');
        const searchRes = document.getElementById('helpSearchResults');
        if (!query.trim()) {
            if (searchRes) searchRes.style.display = 'none';
            if (content) content.style.display = '';
            return;
        }
        if (content) content.style.display = 'none';
        if (searchRes) {
            searchRes.style.display = '';
            const q = query.toLowerCase();
            const results = [];
            Object.entries(HELP_CONTENT).forEach(([page, h]) => {
                const text = `${h.title} ${h.overview} ${(h.steps||[]).map(s => s.title + ' ' + s.desc).join(' ')} ${(h.tips||[]).join(' ')}`.toLowerCase();
                if (text.includes(q)) results.push({ page, h });
            });
            searchRes.innerHTML = results.length === 0
                ? `<div style="text-align:center;color:#aaa;padding:30px">لا نتائج لـ "${query}"</div>`
                : results.map(({ page, h }) => `
                <div onclick="showHelpPage('${page}')" style="border:1.5px solid #e0e8f0;border-radius:8px;padding:10px 14px;margin-bottom:8px;cursor:pointer;background:white"
                    onmouseover="this.style.background='#f0f5fa'" onmouseout="this.style.background='white'">
                    <div style="font-size:12px;font-weight:800;color:#1a3a5c">${h.title}</div>
                    <div style="font-size:11px;color:#666;margin-top:3px">${h.section}</div>
                    <div style="font-size:11px;color:#888;margin-top:4px">${h.overview.substring(0, 80)}...</div>
                </div>`).join('');
        }
    };

    function buildHelpHTML(h) {
        return `
        <div style="border-bottom:3px solid ${h.color};padding:14px;background:${h.color}0d">
            <div style="font-size:15px;font-weight:900;color:${h.color}">${h.title}</div>
            <div style="font-size:10px;color:${h.color}99;font-weight:700;text-transform:uppercase;margin-top:3px;letter-spacing:.5px">${h.section}</div>
        </div>

        <div style="padding:14px">
            <!-- نظرة عامة -->
            <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:14px;border-right:3px solid ${h.color}">
                <div style="font-size:11px;font-weight:700;color:${h.color};margin-bottom:6px">📌 نظرة عامة</div>
                <p style="font-size:12px;color:#444;line-height:1.7;margin:0">${h.overview}</p>
            </div>

            <!-- الخطوات -->
            <div style="margin-bottom:14px">
                <div style="font-size:11px;font-weight:800;color:#1a3a5c;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">🚀 كيفية الاستخدام</div>
                ${(h.steps || []).map((s, i) => `
                <div style="display:flex;gap:10px;margin-bottom:8px;padding:10px;background:white;border:1.5px solid #e8f0f7;border-radius:8px">
                    <div style="width:26px;height:26px;border-radius:50%;background:${h.color};color:white;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">${s.icon}</div>
                    <div>
                        <div style="font-size:12px;font-weight:700;color:#1a3a5c">${s.title}</div>
                        <div style="font-size:11px;color:#666;margin-top:2px;line-height:1.6">${s.desc}</div>
                    </div>
                </div>`).join('')}
            </div>

            <!-- نصائح -->
            ${h.tips?.length ? `
            <div style="margin-bottom:14px">
                <div style="font-size:11px;font-weight:800;color:#1a3a5c;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">💡 نصائح احترافية</div>
                ${h.tips.map(t => `
                <div style="display:flex;gap:8px;margin-bottom:6px;background:#fffbf0;padding:8px;border-radius:7px;border:1px solid #f39c1230">
                    <span style="color:#f39c12;font-size:14px;flex-shrink:0">💡</span>
                    <span style="font-size:11px;color:#555;line-height:1.6">${t}</span>
                </div>`).join('')}
            </div>` : ''}

            <!-- روابط ذات صلة -->
            ${h.related?.length ? `
            <div>
                <div style="font-size:11px;font-weight:800;color:#1a3a5c;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">🔗 أقسام ذات صلة</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                    ${h.related.map(r => `
                    <button onclick="bcNav && bcNav('${r.page}');toggleHelpPanel()"
                        style="background:${h.color}15;color:${h.color};border:1.5px solid ${h.color}40;border-radius:7px;padding:5px 10px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:600"
                        onmouseover="this.style.background='${h.color}30'" onmouseout="this.style.background='${h.color}15'">
                        ${r.label}
                    </button>`).join('')}
                </div>
            </div>` : ''}
        </div>`;
    }

    // تحديث المساعدة عند تغيير الصفحة
    const origNav = window.nav;
    if (origNav) {
        window.nav = function (pg, el) {
            origNav(pg, el);
            const panel = document.getElementById('helpPanel');
            if (panel && panel.style.transform === 'translateX(0%)') {
                showHelpPage(pg);
            }
        };
    }

    // Keyboard shortcut: F1
    document.addEventListener('keydown', e => {
        if (e.key === 'F1') { e.preventDefault(); toggleHelpPanel(); }
    });

})();
