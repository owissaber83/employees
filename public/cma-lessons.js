/* ════════════════════════════════════════════════════════════════
   cma-lessons.js — الشرح التفصيلي لمنهج CMA Part 1 (أستاذ جامعي)
   سطر إنجليزي مبسّط + شرح عربي تحته. المحتوى مُعاد صياغته بأسلوبنا
   (ليس نسخًا من أي كتاب). يُحقن داخل #cmaLessonsBox في صفحة دليل CMA.
   التنظيم: 20 وحدة دراسية موزّعة على 6 نطاقات (Domains) لـ Part 1.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function escH(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // كل سطر: en = جملة إنجليزية مبسّطة، ar = شرحها بالعربي (يسمح بـ <strong>).
  const L = (en, ar) => ({ en, ar });

  const CURRICULUM = [

    /* ══════════ النطاق A: التقارير المالية الخارجية (15%) — الوحدات 1-6 ══════════ */
    {
      n: 1, title: 'External Financial Statements', ar: 'القوائم المالية الخارجية',
      domain: 'النطاق A — التقارير المالية الخارجية (15%)',
      sections: [
        {
          c: '1.1', title: 'Concepts of Financial Accounting', ar: 'مفاهيم المحاسبة المالية',
          lines: [
            L('The objective of general-purpose financial reporting is to provide information useful for resource-allocation decisions.',
              'هدف التقارير المالية ذات الغرض العام تقديم معلومات <strong>مفيدة لقرارات تخصيص الموارد</strong> (استثمار/إقراض). فالقوائم أداة قرار، لا غاية في ذاتها.'),
            L('It reports the entity’s economic resources and claims (position) and the changes in them (performance).',
              'تُظهر <strong>الموارد والمطالبات</strong> (= المركز المالي) و<strong>التغيّرات</strong> عليها (= الأداء)، لتقييم السيولة والملاءة والحاجة للتمويل.'),
            L('Financial accounting serves external users under GAAP; management accounting serves internal users and looks forward.',
              '<strong>المالية</strong>: مستخدمون خارجيون + GAAP + تاريخية. <strong>الإدارية</strong>: الإدارة الداخلية + موجّهة للمستقبل. إن لم يفرّق السؤال استخدم GAAP.'),
            L('Notes are part of the basic financial statements and explain the recognized amounts.',
              '<strong>الإيضاحات جزء أساسي</strong> من القوائم؛ أولها يصف السياسات المحاسبية الهامة (الإهلاك، الاعتراف بالإيراد...).'),
            L('A full set includes five statements, prepared under the going-concern and accrual assumptions.',
              'المجموعة الكاملة = <strong>خمس قوائم</strong> (مركز مالي، دخل، دخل شامل، تغيّرات حقوق ملكية، تدفقات نقدية) على افتراض <strong>الاستمرارية</strong> و<strong>الاستحقاق</strong>.'),
            L('Under accrual accounting, revenue is recognized when earned and expenses when incurred (matching), not when cash moves.',
              'في <strong>الاستحقاق</strong>: الإيراد عند اكتسابه والمصروف عند تكبّده مع <strong>المقابلة</strong>. الأساس النقدي غير مقبول وفق GAAP.'),
          ],
          note: 'الخصائص النوعية: الملاءمة (Relevance) والتمثيل الصادق (Faithful Representation) أساسيتان، تعزّزهما القابلية للمقارنة والتحقّق والتوقيت والفهم.'
        },
        {
          c: '1.2', title: 'Balance Sheet (Statement of Financial Position)', ar: 'قائمة المركز المالي',
          lines: [
            L('The balance sheet reports assets, liabilities, and equity at a point in time: Assets = Liabilities + Equity.',
              'تعرض الأصول والخصوم وحقوق الملكية في <strong>لحظة زمنية</strong> محددة، ومعادلتها: <strong>الأصول = الخصوم + حقوق الملكية</strong>.'),
            L('Assets and liabilities are split into current and noncurrent based on the one-year (or operating cycle) rule.',
              'تُصنَّف إلى <strong>متداولة وغير متداولة</strong> حسب قاعدة السنة (أو الدورة التشغيلية إن طالت): متداول = يُحقّق/يُسدّد خلال سنة.'),
            L('It shows liquidity, financial flexibility, and solvency, but uses mostly historical cost — not fair value.',
              'تكشف <strong>السيولة والمرونة المالية والملاءة</strong>، لكنها بالتكلفة التاريخية غالبًا فلا تعكس القيمة السوقية الحالية.'),
            L('Working capital = current assets − current liabilities.',
              '<strong>رأس المال العامل = الأصول المتداولة − الخصوم المتداولة</strong>؛ مؤشر على القدرة على سداد الالتزامات قصيرة الأجل.'),
          ],
          note: 'قيود الميزانية: لا تُدرج أصولًا داخلية مثل قيمة العلامة المطوّرة ذاتيًا، وتعتمد تقديرات (أعمار، مخصصات).'
        },
        {
          c: '1.3', title: 'Income Statement & Comprehensive Income', ar: 'قائمة الدخل والدخل الشامل',
          lines: [
            L('The income statement reports performance over a period: Revenues − Expenses = Net Income.',
              'تقيس الأداء <strong>خلال فترة</strong>: الإيرادات − المصروفات = <strong>صافي الدخل</strong>.'),
            L('A multiple-step statement separates operating from nonoperating items and shows gross profit.',
              'الشكل <strong>متعدد الخطوات</strong> يفصل التشغيلي عن غير التشغيلي ويُظهر <strong>مجمل الربح</strong> (المبيعات − تكلفة المبيعات).'),
            L('Discontinued operations are reported separately, net of tax, below income from continuing operations.',
              '<strong>العمليات غير المستمرة</strong> تُعرض منفصلة بعد الضريبة أسفل دخل العمليات المستمرة، لعزل أثر ما سيتوقف.'),
            L('Comprehensive income = net income + other comprehensive income (OCI).',
              '<strong>الدخل الشامل = صافي الدخل + الدخل الشامل الآخر (OCI)</strong>؛ ويضم OCI بنودًا كفروق الترجمة والتحوّط وبعض تعديلات المعاشات.'),
          ],
          note: 'بنود OCI الشائعة: تعديلات ترجمة العملات الأجنبية، أرباح/خسائر التحوّط النقدي، وإعادة قياس التزامات المعاشات.'
        },
        {
          c: '1.4', title: 'Statement of Changes in Equity', ar: 'قائمة التغيّرات في حقوق الملكية',
          lines: [
            L('This statement reconciles the beginning and ending balances of each equity component.',
              'تُطابِق رصيد <strong>أول وآخر المدة</strong> لكل بند من حقوق الملكية (رأس المال، علاوة الإصدار، الأرباح المحتجزة، أسهم الخزينة، OCI المتراكم).'),
            L('Retained earnings = beginning RE + net income − dividends.',
              '<strong>الأرباح المحتجزة = أول المدة + صافي الدخل − التوزيعات</strong>؛ هي حلقة الوصل بين قائمة الدخل والميزانية.'),
            L('Treasury stock (reacquired shares) reduces total equity; it is not an asset.',
              '<strong>أسهم الخزينة</strong> (أسهم أعيد شراؤها) تُخفِّض حقوق الملكية وليست أصلًا.'),
          ]
        },
        {
          c: '1.5', title: 'Statement of Cash Flows', ar: 'قائمة التدفقات النقدية',
          lines: [
            L('Cash flows are classified into operating, investing, and financing activities.',
              'تُصنَّف التدفقات إلى <strong>تشغيلية</strong> (النشاط الأساسي)، <strong>استثمارية</strong> (شراء/بيع الأصول والاستثمارات)، و<strong>تمويلية</strong> (الديون وحقوق الملكية والتوزيعات).'),
            L('The indirect method starts from net income and adjusts for noncash items and working-capital changes.',
              'الطريقة <strong>غير المباشرة</strong> تبدأ من صافي الدخل وتعدّل البنود غير النقدية (الإهلاك) والتغيّر في رأس المال العامل — وهي الأكثر شيوعًا.'),
            L('The direct method lists actual cash receipts and payments from operations.',
              'الطريقة <strong>المباشرة</strong> تسرد المقبوضات والمدفوعات النقدية الفعلية للتشغيل (مقبوضات من العملاء، مدفوعات للموردين...).'),
            L('Both methods give the same total operating cash flow; only the operating section differs.',
              'الطريقتان تعطيان <strong>نفس إجمالي التدفق التشغيلي</strong>؛ الاختلاف في عرض القسم التشغيلي فقط.'),
          ],
          note: 'فخ شائع: الإهلاك ليس مصدرًا للنقد، بل يُضاف فقط لأنه خُصِم من صافي الدخل دون أن يستنزف نقدًا.'
        },
        {
          c: '1.6', title: 'Limitations & Articulation of the Statements', ar: 'حدود القوائم وترابطها',
          lines: [
            L('The statements articulate: an item in one statement ties to amounts in another.',
              'القوائم <strong>مترابطة (Articulation)</strong>: صافي الدخل يربط قائمة الدخل بالأرباح المحتجزة، ورصيد النقد يربط الميزانية بقائمة التدفقات.'),
            L('Statements rely on estimates, historical cost, and judgment, and ignore inflation and nonfinancial value.',
              'تعتمد على <strong>تقديرات</strong> وتكلفة تاريخية وأحكام، وتتجاهل التضخّم والقيم غير المالية (الكفاءات، السمعة).'),
            L('Different acceptable accounting policies reduce comparability across firms.',
              'تعدّد السياسات المقبولة (مثل طرق المخزون) يُضعف <strong>القابلية للمقارنة</strong> بين الشركات.'),
          ]
        },
      ]
    },

    {
      n: 2, title: 'Assets — Short-Term Items', ar: 'الأصول — البنود قصيرة الأجل',
      domain: 'النطاق A — التقارير المالية الخارجية (15%)',
      sections: [
        {
          c: '2.1', title: 'Cash and Cash Equivalents', ar: 'النقد وما في حكمه',
          lines: [
            L('Cash equivalents are highly liquid investments with original maturity of three months or less.',
              '<strong>ما في حكم النقد</strong> استثمارات عالية السيولة استحقاقها الأصلي <strong>ثلاثة أشهر أو أقل</strong> (أذون خزانة، ودائع قصيرة).'),
            L('Restricted cash and compensating balances are disclosed separately from available cash.',
              '<strong>النقد المقيّد</strong> والأرصدة المعوّضة تُفصح منفصلة لأنها غير متاحة للاستخدام الحر.'),
            L('Bank reconciliations adjust both the book balance and the bank balance to a correct cash figure.',
              '<strong>التسوية البنكية</strong> تعدّل رصيد الدفاتر (مصاريف بنكية، شيكات مرتدة) ورصيد البنك (إيداعات/شيكات معلّقة) للوصول للرصيد الصحيح.'),
          ]
        },
        {
          c: '2.2', title: 'Receivables', ar: 'الذمم المدينة (المدينون)',
          lines: [
            L('Accounts receivable are reported at net realizable value (gross minus the allowance for doubtful accounts).',
              'تُعرض الذمم بصافي القيمة القابلة للتحقق = الإجمالي − <strong>مخصص الديون المشكوك فيها</strong>.'),
            L('The allowance method estimates bad debts in advance to match expense with revenue.',
              'طريقة <strong>المخصص</strong> تقدّر الديون المعدومة مقدمًا (نسبة من المبيعات أو من أعمار الذمم) لتحقيق المقابلة — وهي المقبولة وفق GAAP.'),
            L('Pledging, assigning, and factoring convert receivables into cash; factoring without recourse transfers the risk.',
              '<strong>التحويل/البيع (Factoring)</strong> يحوّل الذمم لنقد؛ "بدون حق رجوع" ينقل مخاطر التحصيل للمشتري، و"بحق رجوع" يبقيها على البائع.'),
            L('Notes receivable are recorded at present value when interest is below market.',
              '<strong>أوراق القبض</strong> تُسجّل بالقيمة الحالية إذا كانت فائدتها أقل من السوق، مع إثبات فائدة ضمنية.'),
          ]
        },
        {
          c: '2.3', title: 'Inventory', ar: 'المخزون',
          lines: [
            L('Inventory cost includes purchase price, freight-in, and costs to get goods ready for sale.',
              'تكلفة المخزون تشمل سعر الشراء + <strong>مصاريف الشحن الداخل</strong> + كل ما يلزم لجعله جاهزًا للبيع.'),
            L('Cost-flow assumptions: FIFO, LIFO, and weighted average assign different costs to COGS and ending inventory.',
              'افتراضات تدفّق التكلفة: <strong>FIFO</strong> (الوارد أولًا صادر أولًا)، <strong>LIFO</strong> (الوارد أخيرًا صادر أولًا)، و<strong>المتوسط المرجح</strong> — كلٌّ يوزّع التكلفة بين تكلفة المبيعات والمخزون بشكل مختلف.'),
            L('In rising prices, FIFO gives higher net income and ending inventory; LIFO gives lower (and lower taxes).',
              'وقت <strong>ارتفاع الأسعار</strong>: FIFO يعطي ربحًا ومخزونًا أعلى، وLIFO يعطي ربحًا أقل وضريبة أقل. (LIFO ممنوع وفق IFRS).'),
            L('Inventory is written down to the lower of cost or net realizable value (or market under LIFO).',
              'يُخفَّض المخزون إلى <strong>الأقل من التكلفة أو صافي القيمة البيعية</strong> (LCNRV)؛ ولا يُعاد رفعه وفق US GAAP.'),
            L('Perpetual updates inventory after each transaction; periodic updates only at period end.',
              'النظام <strong>المستمر</strong> يحدّث المخزون بعد كل حركة، و<strong>الدوري</strong> يحدّثه بالجرد آخر الفترة فقط.'),
          ],
          note: 'صيغة تكلفة المبيعات: بضاعة أول المدة + المشتريات الصافية − بضاعة آخر المدة = COGS.'
        },
      ]
    },

    {
      n: 3, title: 'Assets — Long-Term Items', ar: 'الأصول — البنود طويلة الأجل',
      domain: 'النطاق A — التقارير المالية الخارجية (15%)',
      sections: [
        {
          c: '3.1', title: 'Property, Plant & Equipment', ar: 'الممتلكات والمصانع والمعدات',
          lines: [
            L('PP&E is capitalized at all costs necessary to acquire and ready the asset for use.',
              'تُرسمل الأصول الثابتة بكل التكاليف اللازمة <strong>لاقتنائها وتجهيزها للاستخدام</strong> (الثمن، الشحن، التركيب، التأسيس).'),
            L('Capital expenditures are capitalized; ordinary repairs are expensed.',
              '<strong>الإنفاق الرأسمالي</strong> (يطيل العمر/يزيد الطاقة) يُرسمل، أما <strong>الصيانة العادية</strong> فتُحمَّل مصروفًا فورًا.'),
            L('Depreciation methods: straight-line, units of production, declining balance, and sum-of-years-digits.',
              'طرق الإهلاك: <strong>القسط الثابت</strong>، <strong>وحدات الإنتاج</strong>، <strong>المتناقص</strong>، و<strong>مجموع أرقام السنين</strong>؛ الأخيرتان مُعجّلتان.'),
            L('Depreciation allocates cost; it is not a valuation of the asset at market.',
              'الإهلاك <strong>توزيع للتكلفة</strong> على العمر الإنتاجي، وليس تقييمًا للأصل بالسوق.'),
          ]
        },
        {
          c: '3.2', title: 'Intangible Assets & Goodwill', ar: 'الأصول غير الملموسة والشهرة',
          lines: [
            L('Finite-life intangibles are amortized; indefinite-life intangibles and goodwill are not amortized but tested for impairment.',
              'محدودة العمر (براءات) <strong>تُطفأ</strong>، وغير محدّدة العمر و<strong>الشهرة لا تُطفأ</strong> بل تُختبر سنويًا لانخفاض القيمة.'),
            L('Goodwill arises only in a business combination = purchase price minus fair value of identifiable net assets.',
              '<strong>الشهرة</strong> تنشأ فقط عند <strong>شراء منشأة</strong> = ثمن الشراء − القيمة العادلة لصافي الأصول القابلة للتحديد.'),
            L('Research costs are expensed; under US GAAP most R&D is expensed as incurred.',
              'تكاليف <strong>البحث تُحمَّل مصروفًا</strong>؛ ووفق US GAAP تُحمَّل معظم R&D فور تكبّدها (مع رسملة بعض تكاليف التطوير وفق IFRS).'),
          ]
        },
        {
          c: '3.3', title: 'Impairment of Long-Lived Assets', ar: 'انخفاض قيمة الأصول طويلة الأجل',
          lines: [
            L('Under US GAAP, impairment uses a two-step test: recoverability then measurement of the loss.',
              'وفق US GAAP اختبار من <strong>خطوتين</strong>: أولًا قابلية الاسترداد (مقارنة التدفقات غير المخصومة بالقيمة الدفترية)، ثم قياس الخسارة (الدفترية − العادلة).'),
            L('An impairment loss reduces the asset and cannot be reversed under US GAAP.',
              'خسارة الانخفاض تُخفِّض الأصل و<strong>لا يجوز ردّها لاحقًا</strong> وفق US GAAP (بخلاف IFRS الذي يسمح بالرد لغير الشهرة).'),
          ]
        },
        {
          c: '3.4', title: 'Investments', ar: 'الاستثمارات',
          lines: [
            L('Debt securities are classified as trading, available-for-sale, or held-to-maturity.',
              'سندات الدين تُصنَّف: <strong>للمتاجرة</strong> (التغيّر في الدخل)، <strong>متاحة للبيع</strong> (التغيّر في OCI)، أو <strong>محتفظ بها للاستحقاق</strong> (بالتكلفة المطفأة).'),
            L('Equity investments with no significant influence are measured at fair value through net income.',
              'استثمارات الأسهم دون تأثير جوهري تُقاس <strong>بالقيمة العادلة عبر الدخل</strong>.'),
            L('Significant influence (≈20–50%) uses the equity method; control (>50%) requires consolidation.',
              '<strong>التأثير الجوهري</strong> (≈20–50%) يُحاسب بطريقة حقوق الملكية، و<strong>السيطرة</strong> (>50%) توجب التوحيد (Consolidation).'),
          ]
        },
      ]
    },

    {
      n: 4, title: 'Liabilities', ar: 'الخصوم (الالتزامات)',
      domain: 'النطاق A — التقارير المالية الخارجية (15%)',
      sections: [
        {
          c: '4.1', title: 'Current Liabilities & Contingencies', ar: 'الخصوم المتداولة والالتزامات المحتملة',
          lines: [
            L('Current liabilities are obligations due within one year or the operating cycle.',
              '<strong>الخصوم المتداولة</strong> التزامات تُسدّد خلال سنة أو الدورة التشغيلية (دائنون، مصروفات مستحقة، الجزء المتداول من الديون).'),
            L('A loss contingency is accrued when probable and reasonably estimable.',
              '<strong>الالتزام المحتمل</strong> يُثبَت (يُجنَّب) إذا كان <strong>محتملًا (probable) وقابلًا للتقدير</strong>؛ وإلا يُفصح عنه فقط.'),
            L('Gain contingencies are not recognized until realized (conservatism).',
              '<strong>المكاسب المحتملة لا تُثبَت</strong> حتى تتحقق فعلًا، التزامًا بمبدأ الحيطة والحذر.'),
          ]
        },
        {
          c: '4.2', title: 'Bonds & Long-Term Debt', ar: 'السندات والديون طويلة الأجل',
          lines: [
            L('Bonds issued below face sell at a discount; above face at a premium.',
              'إذا كان سعر الكوبون أقل من سعر السوق تُباع السندات <strong>بخصم</strong>، وإن كان أعلى تُباع <strong>بعلاوة</strong>.'),
            L('The effective-interest method amortizes the discount/premium so interest expense reflects the market rate.',
              'طريقة <strong>الفائدة الفعّالة</strong> تُطفئ الخصم/العلاوة بحيث تعكس مصروف الفائدة <strong>سعر السوق</strong> على القيمة الدفترية.'),
            L('Carrying value moves toward face value over the bond’s life.',
              'القيمة الدفترية للسند <strong>تتجه نحو القيمة الاسمية</strong> مع اقتراب الاستحقاق.'),
          ]
        },
        {
          c: '4.3', title: 'Leases (ASC 842 / IFRS 16)', ar: 'عقود الإيجار',
          lines: [
            L('A lessee recognizes a right-of-use asset and a lease liability for most leases.',
              'يُثبت المستأجر <strong>أصل حق الاستخدام</strong> و<strong>التزام إيجار</strong> لمعظم العقود — فلم تعد تُخفى خارج الميزانية.'),
            L('Finance leases transfer ownership-like risks; operating leases do not, affecting expense pattern.',
              'الإيجار <strong>التمويلي</strong> ينقل مخاطر/منافع شبه الملكية (إهلاك + فائدة)، والتشغيلي يعرض مصروفًا واحدًا مستقيمًا.'),
          ]
        },
        {
          c: '4.4', title: 'Deferred Income Taxes', ar: 'الضرائب المؤجلة',
          lines: [
            L('Temporary differences between book and tax income create deferred tax assets or liabilities.',
              'الفروق <strong>المؤقتة</strong> بين الربح المحاسبي والضريبي تنشئ <strong>أصول/خصوم ضريبية مؤجلة</strong> تنعكس مستقبلًا.'),
            L('A deferred tax liability arises when book income exceeds taxable income now (e.g., accelerated tax depreciation).',
              '<strong>خصم ضريبي مؤجّل</strong> ينشأ حين يكون الربح المحاسبي حاليًا أكبر من الضريبي (مثل الإهلاك الضريبي المعجّل).'),
            L('A valuation allowance reduces a deferred tax asset when realization is not more likely than not.',
              '<strong>مخصص التقييم</strong> يُخفِّض الأصل الضريبي المؤجل إذا كان تحقّقه غير مرجّح (أقل من 50%).'),
            L('Permanent differences (e.g., tax-exempt interest) never reverse and create no deferred tax.',
              'الفروق <strong>الدائمة</strong> (فوائد معفاة، غرامات) لا تنعكس ولا تنشئ ضريبة مؤجلة.'),
          ]
        },
      ]
    },

    {
      n: 5, title: 'Equity, Revenue & Expense Recognition', ar: 'حقوق الملكية والاعتراف بالإيراد والمصروف',
      domain: 'النطاق A — التقارير المالية الخارجية (15%)',
      sections: [
        {
          c: '5.1', title: 'Stockholders’ Equity', ar: 'حقوق الملكية',
          lines: [
            L('Equity = contributed capital + retained earnings + accumulated OCI − treasury stock.',
              'حقوق الملكية = <strong>رأس المال المدفوع + الأرباح المحتجزة + OCI المتراكم − أسهم الخزينة</strong>.'),
            L('Preferred stock has priority over common in dividends and liquidation.',
              '<strong>الأسهم الممتازة</strong> لها أولوية على العادية في التوزيعات وعند التصفية، وقد تكون مجمّعة (cumulative).'),
            L('Stock dividends and splits do not change total equity; cash dividends reduce retained earnings and cash.',
              '<strong>توزيعات الأسهم والتجزئة</strong> لا تغيّر إجمالي حقوق الملكية، أما <strong>التوزيع النقدي</strong> فيخفّض الأرباح المحتجزة والنقد.'),
          ]
        },
        {
          c: '5.2', title: 'Revenue Recognition (5-Step Model)', ar: 'الاعتراف بالإيراد (نموذج الخطوات الخمس)',
          lines: [
            L('Step 1–2: identify the contract and the distinct performance obligations.',
              'الخطوة 1–2: تحديد <strong>العقد</strong> و<strong>التزامات الأداء المتمايزة</strong> (الوعود المنفصلة للعميل).'),
            L('Step 3–4: determine the transaction price and allocate it to the obligations.',
              'الخطوة 3–4: تحديد <strong>سعر المعاملة</strong> (مع المقابل المتغيّر) و<strong>تخصيصه</strong> على الالتزامات حسب أسعارها المستقلة.'),
            L('Step 5: recognize revenue when (or as) each performance obligation is satisfied.',
              'الخطوة 5: الاعتراف بالإيراد <strong>عند أو على مدار الوفاء</strong> بكل التزام (نقل السيطرة للعميل).'),
            L('Revenue can be recognized over time when control transfers continuously (e.g., long-term construction).',
              'يُعترف بالإيراد <strong>على مدار الزمن</strong> عند نقل السيطرة باستمرار (مثل عقود الإنشاء طويلة الأجل بنسبة الإنجاز).'),
          ],
          note: 'مرتبط مباشرة بنشاطك: مقاولات GBR — عقود الإنشاء تُعترف عادةً بنسبة الإنجاز (Over time) لا عند التسليم النهائي.'
        },
        {
          c: '5.3', title: 'Expense Recognition', ar: 'الاعتراف بالمصروف',
          lines: [
            L('Expenses are recognized by matching with revenue, systematic allocation, or immediate recognition.',
              'يُعترف بالمصروف بثلاث طرق: <strong>المقابلة</strong> بالإيراد، أو <strong>التوزيع المنتظم</strong> (الإهلاك)، أو <strong>الاعتراف الفوري</strong> عند انعدام منفعة مستقبلية.'),
            L('Prepaid costs are assets until consumed; accrued expenses are liabilities until paid.',
              '<strong>المصروفات المقدمة</strong> أصول حتى تُستهلك، و<strong>المصروفات المستحقة</strong> خصوم حتى تُسدّد.'),
          ]
        },
      ]
    },

    {
      n: 6, title: 'Income Measurement, EPS & GAAP vs IFRS', ar: 'قياس الدخل وربحية السهم و GAAP مقابل IFRS',
      domain: 'النطاق A — التقارير المالية الخارجية (15%)',
      sections: [
        {
          c: '6.1', title: 'Earnings per Share', ar: 'ربحية السهم',
          lines: [
            L('Basic EPS = (net income − preferred dividends) ÷ weighted-average common shares.',
              '<strong>ربحية السهم الأساسية = (صافي الدخل − توزيعات الممتازة) ÷ المتوسط المرجح للأسهم العادية</strong>.'),
            L('Diluted EPS includes potential shares from options, warrants, and convertibles (if dilutive).',
              '<strong>الربحية المخفّفة</strong> تضيف الأسهم المحتملة من الخيارات والأدوات القابلة للتحويل إن كانت مُخفِّفة (تُنقِص الربحية).'),
          ]
        },
        {
          c: '6.2', title: 'US GAAP vs IFRS — Key Differences', ar: 'أهم الفروق بين US GAAP و IFRS',
          lines: [
            L('LIFO is allowed under US GAAP but prohibited under IFRS.',
              'طريقة <strong>LIFO مسموحة في US GAAP وممنوعة في IFRS</strong>.'),
            L('IFRS allows reversal of impairment (except goodwill); US GAAP does not.',
              'IFRS يسمح بـ<strong>رد خسارة الانخفاض</strong> (عدا الشهرة)، وUS GAAP لا يسمح.'),
            L('IFRS permits the revaluation model for PP&E; US GAAP uses historical cost only.',
              'IFRS يجيز <strong>نموذج إعادة التقييم</strong> للأصول الثابتة، بينما US GAAP يلتزم بالتكلفة التاريخية.'),
            L('IFRS is principles-based; US GAAP is more rules-based.',
              'IFRS <strong>قائم على المبادئ</strong> وأكثر مرونة، وUS GAAP <strong>قائم على القواعد</strong> وأكثر تفصيلًا.'),
          ]
        },
        {
          c: '6.3', title: 'SEC Reporting & Integrated Reporting', ar: 'تقارير الهيئة والتقارير المتكاملة',
          lines: [
            L('Public companies file 10-K (annual), 10-Q (quarterly), and 8-K (material events) with the SEC.',
              'الشركات المدرجة تقدّم للهيئة <strong>10-K</strong> (سنوي)، <strong>10-Q</strong> (ربعي)، و<strong>8-K</strong> (أحداث جوهرية).'),
            L('Integrated reporting links financial results to ESG and value-creation over time.',
              'التقارير <strong>المتكاملة</strong> تربط الأداء المالي بعوامل الاستدامة والحوكمة (ESG) وخلق القيمة على المدى الطويل.'),
          ]
        },
      ]
    },

    /* ══════════ النطاق D: إدارة التكاليف (15%) — الوحدات 7-11 ══════════ */
    {
      n: 7, title: 'Cost Management Concepts', ar: 'مفاهيم إدارة التكاليف',
      domain: 'النطاق D — إدارة التكاليف (15%)',
      sections: [
        {
          c: '7.1', title: 'Cost Terminology & Classification', ar: 'مصطلحات وتصنيف التكاليف',
          lines: [
            L('Costs are classified as direct/indirect, product/period, and fixed/variable.',
              'تُصنَّف التكاليف: <strong>مباشرة/غير مباشرة</strong>، <strong>تكلفة منتج/تكلفة فترة</strong>، و<strong>ثابتة/متغيّرة</strong>.'),
            L('Product costs (DM, DL, OH) attach to inventory; period costs are expensed when incurred.',
              '<strong>تكاليف المنتج</strong> (مواد مباشرة + أجور مباشرة + صناعية غير مباشرة) تلتصق بالمخزون، و<strong>تكاليف الفترة</strong> (بيع وإدارة) تُحمَّل فورًا.'),
            L('Prime cost = DM + DL; conversion cost = DL + OH.',
              '<strong>التكلفة الأولية = مواد مباشرة + أجور مباشرة</strong>؛ <strong>تكلفة التحويل = أجور مباشرة + تكاليف صناعية</strong>.'),
          ]
        },
        {
          c: '7.2', title: 'Cost Behavior & the Relevant Range', ar: 'سلوك التكلفة والمدى الملائم',
          lines: [
            L('Within the relevant range, total fixed cost stays constant and total variable cost changes with volume.',
              'ضمن <strong>المدى الملائم</strong>: إجمالي <strong>الثابت يبقى ثابتًا</strong>، وإجمالي <strong>المتغيّر يتغيّر مع الحجم</strong>.'),
            L('Per unit, fixed cost decreases as volume rises while variable cost per unit stays constant.',
              'لكل وحدة: التكلفة <strong>الثابتة للوحدة تنخفض</strong> بزيادة الحجم، و<strong>المتغيّرة للوحدة تبقى ثابتة</strong>.'),
            L('Mixed costs are split into fixed and variable parts using the high-low method or regression.',
              'التكاليف <strong>المختلطة</strong> تُفصل لجزء ثابت ومتغيّر بطريقة <strong>الأعلى-الأدنى</strong> أو الانحدار الإحصائي.'),
          ]
        },
        {
          c: '7.3', title: 'Cost of Goods Manufactured & Sold', ar: 'تكلفة البضاعة المصنّعة والمباعة',
          lines: [
            L('COGM = DM used + DL + OH applied + beginning WIP − ending WIP.',
              '<strong>تكلفة المصنّع = المواد المستخدمة + الأجور المباشرة + الصناعية المحمّلة + إنتاج تحت التشغيل أول المدة − آخر المدة</strong>.'),
            L('COGS = beginning finished goods + COGM − ending finished goods.',
              '<strong>تكلفة المباع = تام الصنع أول المدة + تكلفة المصنّع − تام الصنع آخر المدة</strong>.'),
          ]
        },
      ]
    },

    {
      n: 8, title: 'Cost Accumulation Systems', ar: 'أنظمة تجميع التكاليف',
      domain: 'النطاق D — إدارة التكاليف (15%)',
      sections: [
        {
          c: '8.1', title: 'Job-Order Costing', ar: 'تكاليف الأوامر الإنتاجية',
          lines: [
            L('Job-order costing accumulates costs by individual job or project — ideal for custom work.',
              'تجمع التكاليف لكل <strong>أمر/مشروع منفصل</strong> — مثالية للأعمال المخصّصة (المقاولات، الطباعة، الأثاث حسب الطلب).'),
            L('Overhead is applied using a predetermined rate × actual cost driver.',
              'تُحمَّل التكاليف الصناعية بـ<strong>معدل محدد مسبقًا × مقدار محرّك التكلفة الفعلي</strong>.'),
          ],
          note: 'مناسب لنشاط GBR: كل مشروع مقاولات = أمر إنتاجي تُجمَّع تكاليفه على حدة لقياس ربحيته.'
        },
        {
          c: '8.2', title: 'Process Costing', ar: 'تكاليف المراحل',
          lines: [
            L('Process costing averages costs over many identical units flowing through processes.',
              'توزّع التكاليف <strong>كمتوسط على وحدات متماثلة</strong> تمر عبر مراحل (كيماويات، أغذية، نفط).'),
            L('Equivalent units (EUP) convert partially completed units into whole-unit equivalents.',
              '<strong>وحدات الإنتاج المكافئة (EUP)</strong> تحوّل الوحدات نصف المكتملة إلى ما يعادلها من وحدات تامة لتوزيع التكلفة.'),
            L('Weighted-average and FIFO are the two EUP methods.',
              'طريقتا حساب EUP: <strong>المتوسط المرجح</strong> و<strong>FIFO</strong>؛ الفرق في معالجة بضاعة أول المدة.'),
          ]
        },
        {
          c: '8.3', title: 'Activity-Based Costing (ABC)', ar: 'التكاليف على أساس الأنشطة',
          lines: [
            L('ABC assigns overhead to products based on the activities that drive cost.',
              'يوزّع <strong>ABC</strong> التكاليف غير المباشرة حسب <strong>الأنشطة المسبّبة للتكلفة</strong> ومحرّكاتها، لا حسب حجم إنتاج واحد.'),
            L('ABC improves accuracy when products consume resources very differently.',
              'يحسّن <strong>دقة التكلفة</strong> حين تستهلك المنتجات الموارد بنسب مختلفة جدًا، فيكشف منتجات خاسرة كانت تبدو رابحة.'),
            L('It is costlier to implement but reduces cost distortion from a single plantwide rate.',
              'أعلى كلفة في التطبيق، لكنه يقلّل <strong>تشويه التكلفة</strong> الناتج عن معدل تحميل وحيد للمصنع كله.'),
          ]
        },
        {
          c: '8.4', title: 'Life-Cycle Costing', ar: 'تكاليف دورة الحياة',
          lines: [
            L('Life-cycle costing tracks all costs from R&D to disposal across a product’s whole life.',
              'تتبّع <strong>كل التكاليف</strong> من البحث والتطوير حتى الاستبعاد عبر عمر المنتج كاملًا، لا فترة واحدة.'),
            L('Most of a product’s costs are locked in during the design stage.',
              'معظم تكاليف المنتج <strong>تُحدَّد (تُقفل) في مرحلة التصميم</strong>، لذا الإدارة المبكرة للتكلفة أكثر فاعلية.'),
          ]
        },
      ]
    },

    {
      n: 9, title: 'Cost Allocation Techniques', ar: 'أساليب توزيع التكاليف',
      domain: 'النطاق D — إدارة التكاليف (15%)',
      sections: [
        {
          c: '9.1', title: 'Overhead Allocation', ar: 'توزيع التكاليف غير المباشرة',
          lines: [
            L('A predetermined OH rate = estimated overhead ÷ estimated cost driver.',
              '<strong>معدل التحميل المحدد مسبقًا = التكاليف الصناعية المقدّرة ÷ محرّك التكلفة المقدّر</strong> (ساعات عمل/آلة).'),
            L('Over-applied overhead means applied > actual; under-applied means applied < actual.',
              '<strong>تحميل زائد</strong> = المحمَّل أكبر من الفعلي، و<strong>تحميل ناقص</strong> = أقل من الفعلي؛ يُسوّى الفرق في COGS أو يوزّع.'),
          ]
        },
        {
          c: '9.2', title: 'Service Department Allocation', ar: 'توزيع تكاليف الأقسام الخدمية',
          lines: [
            L('The direct method ignores services between service departments.',
              'الطريقة <strong>المباشرة</strong> توزّع تكاليف الأقسام الخدمية على الإنتاجية فقط وتتجاهل الخدمات المتبادلة بينها.'),
            L('The step (step-down) method allocates one way, in sequence.',
              'الطريقة <strong>التنازلية</strong> توزّع بترتيب أحادي الاتجاه (قسم خدمي ثم التالي) دون رجوع.'),
            L('The reciprocal method fully recognizes mutual services and is the most accurate.',
              'الطريقة <strong>التبادلية</strong> تعترف بالخدمات المتبادلة بالكامل وهي <strong>الأدق</strong> (وتستخدم معادلات آنية).'),
          ]
        },
        {
          c: '9.3', title: 'Joint Products & By-Products', ar: 'المنتجات المشتركة والثانوية',
          lines: [
            L('Joint costs are allocated at the split-off point using sales value, NRV, or physical units.',
              'تُوزَّع <strong>التكاليف المشتركة</strong> عند <strong>نقطة الانفصال</strong> بطرق: القيمة البيعية، صافي القيمة البيعية، أو الوحدات المادية.'),
            L('Joint costs are irrelevant to the sell-or-process-further decision; only incremental costs/revenues matter.',
              'التكاليف المشتركة <strong>غير ملائمة</strong> لقرار "البيع الآن أم المعالجة الإضافية"؛ المهم الإيراد والتكلفة <strong>الإضافيان</strong> فقط.'),
          ]
        },
      ]
    },

    {
      n: 10, title: 'Costing Methods & Operational Efficiency', ar: 'طرق التكلفة والكفاءة التشغيلية',
      domain: 'النطاق D — إدارة التكاليف (15%)',
      sections: [
        {
          c: '10.1', title: 'Absorption vs Variable Costing', ar: 'التكلفة الكلية مقابل المتغيّرة',
          lines: [
            L('Absorption costing includes fixed overhead in product cost; variable costing treats it as a period cost.',
              '<strong>التكلفة الكلية</strong> تُدخل التكاليف الصناعية الثابتة في تكلفة المنتج، و<strong>المتغيّرة</strong> تعاملها كتكلفة فترة.'),
            L('When production > sales, absorption income > variable income (fixed cost deferred in inventory).',
              'حين يفوق <strong>الإنتاج المبيعات</strong>: ربح التكلفة الكلية أعلى لأن جزءًا من الثابت يُؤجَّل داخل المخزون.'),
            L('Absorption costing is required for external GAAP reporting; variable costing aids internal decisions.',
              'التكلفة الكلية <strong>مطلوبة للتقارير الخارجية</strong> (GAAP)، والمتغيّرة <strong>أنسب للقرارات الداخلية</strong> وهامش المساهمة.'),
          ]
        },
        {
          c: '10.2', title: 'JIT, Lean & Theory of Constraints', ar: 'الإنتاج اللحظي والرشيق ونظرية القيود',
          lines: [
            L('JIT minimizes inventory by producing only as needed, reducing holding costs and waste.',
              '<strong>JIT</strong> يقلّل المخزون بالإنتاج <strong>عند الحاجة فقط</strong>، فيخفّض تكاليف التخزين والهدر لكنه حساس لتعطّل الإمداد.'),
            L('Lean focuses on eliminating non-value-added activities (the seven wastes).',
              'الإنتاج <strong>الرشيق</strong> يركّز على إزالة <strong>الأنشطة غير المضيفة للقيمة</strong> (الهدر السبعة: انتظار، نقل، مخزون زائد...).'),
            L('Theory of constraints maximizes throughput by managing the bottleneck.',
              '<strong>نظرية القيود</strong> ترفع الإنتاجية (Throughput) عبر <strong>إدارة عنق الزجاجة</strong> (المورد الأبطأ) لأنه يحدّد طاقة النظام كلها.'),
          ]
        },
        {
          c: '10.3', title: 'Costs of Quality', ar: 'تكاليف الجودة',
          lines: [
            L('Conformance costs (prevention + appraisal) are spent to avoid defects.',
              'تكاليف <strong>المطابقة = الوقاية + التقييم</strong>، تُنفق <strong>لتجنّب العيوب</strong> (تدريب، فحص، صيانة).'),
            L('Nonconformance costs (internal + external failure) result from defects.',
              'تكاليف <strong>عدم المطابقة = الفشل الداخلي + الخارجي</strong>، تنتج <strong>عن العيوب</strong> (إعادة تشغيل، ضمان، فقد العميل).'),
            L('Investing in prevention usually lowers total quality cost.',
              'الإنفاق على <strong>الوقاية</strong> عادةً يخفّض <strong>إجمالي تكلفة الجودة</strong> لأنه يمنع الفشل الأغلى لاحقًا.'),
          ]
        },
      ]
    },

    {
      n: 11, title: 'Business Process Performance', ar: 'أداء العمليات والتحسين',
      domain: 'النطاق D — إدارة التكاليف (15%)',
      sections: [
        {
          c: '11.1', title: 'Value Chain & Process Improvement', ar: 'سلسلة القيمة وتحسين العمليات',
          lines: [
            L('The value chain links all activities that add value from suppliers to customers.',
              '<strong>سلسلة القيمة</strong> تربط كل الأنشطة المضيفة للقيمة من المورّد إلى العميل، لتحديد مصادر الميزة التنافسية.'),
            L('Business process reengineering radically redesigns processes for major gains.',
              '<strong>إعادة هندسة العمليات (BPR)</strong> إعادة تصميم جذرية للعمليات لتحقيق قفزات في الأداء، لا تحسينًا تدريجيًا.'),
            L('Kaizen is continuous, incremental improvement by everyone.',
              '<strong>Kaizen</strong> تحسين <strong>مستمر وتدريجي</strong> يشارك فيه الجميع، عكس التغيير الجذري لـ BPR.'),
          ]
        },
        {
          c: '11.2', title: 'Benchmarking & ERP', ar: 'المقارنة المرجعية وأنظمة ERP',
          lines: [
            L('Benchmarking compares performance against best-in-class to close gaps.',
              '<strong>المقارنة المرجعية</strong> تقيس الأداء مقابل <strong>الأفضل في المجال</strong> لتحديد فجوات التحسين.'),
            L('ERP integrates all business functions in one shared database in real time.',
              'أنظمة <strong>ERP</strong> تدمج كل وظائف الشركة (محاسبة، مخزون، مشتريات، موارد بشرية) في <strong>قاعدة بيانات موحّدة فورية</strong> — وهذا جوهر تطبيق GBR نفسه.'),
          ]
        },
      ]
    },

    /* ══════════ النطاق B: التخطيط والموازنات والتنبؤ (20%) — الوحدات 12-14 ══════════ */
    {
      n: 12, title: 'Budgeting Concepts & Methodologies', ar: 'مفاهيم ومنهجيات الموازنة',
      domain: 'النطاق B — التخطيط والموازنات والتنبؤ (20%)',
      sections: [
        {
          c: '12.1', title: 'Strategic Planning & the Budget’s Role', ar: 'التخطيط الاستراتيجي ودور الموازنة',
          lines: [
            L('Budgets translate strategy into quantified plans and coordinate the organization.',
              '<strong>الموازنة</strong> تترجم الاستراتيجية إلى خطط رقمية، وتنسّق بين الإدارات، وتُحدّد المسؤوليات، وتوفّر معيارًا للرقابة.'),
            L('Participative (bottom-up) budgeting improves buy-in but risks budgetary slack.',
              'الموازنة <strong>التشاركية</strong> ترفع الالتزام والدافعية لكنها تخاطر بـ<strong>التراخي/الوسادة (slack)</strong> بتعمّد تقديرات متحفظة.'),
          ]
        },
        {
          c: '12.2', title: 'The Master Budget', ar: 'الموازنة الشاملة',
          lines: [
            L('The master budget = operating budget + financial budget, all driven by the sales forecast.',
              '<strong>الموازنة الشاملة = الموازنة التشغيلية + المالية</strong>، وتنطلق جميعها من <strong>تنبؤ المبيعات</strong> كنقطة بداية.'),
            L('The operating budget builds to a budgeted income statement; the financial budget to a cash budget and pro forma balance sheet.',
              'التشغيلية تنتهي بـ<strong>قائمة دخل تقديرية</strong>، والمالية تنتهي بـ<strong>موازنة نقدية</strong> وميزانية تقديرية.'),
          ]
        },
        {
          c: '12.3', title: 'Budgeting Methodologies', ar: 'منهجيات إعداد الموازنة',
          lines: [
            L('Zero-based budgeting justifies every cost from zero each period.',
              'الموازنة <strong>الصفرية</strong> تبرّر كل بند <strong>من الصفر</strong> كل فترة، لا بناءً على العام السابق — دقيقة لكنها مكلفة الوقت.'),
            L('A flexible budget adjusts to the actual activity level for fair variance analysis.',
              'الموازنة <strong>المرنة</strong> تُعدَّل حسب <strong>مستوى النشاط الفعلي</strong> لمقارنة عادلة عند تحليل الانحرافات.'),
            L('A rolling (continuous) budget always maintains a forward horizon by adding a period as one ends.',
              'الموازنة <strong>المستمرة/المتدحرجة</strong> تضيف فترة جديدة كلما انتهت فترة، فتبقي أفقًا زمنيًا ثابتًا للأمام.'),
          ]
        },
      ]
    },

    {
      n: 13, title: 'Forecasting Techniques', ar: 'أساليب التنبؤ',
      domain: 'النطاق B — التخطيط والموازنات والتنبؤ (20%)',
      sections: [
        {
          c: '13.1', title: 'Regression Analysis', ar: 'تحليل الانحدار',
          lines: [
            L('Simple regression fits y = a + bx to estimate fixed (a) and variable (b) cost components.',
              'الانحدار البسيط يقدّر <strong>y = a + bx</strong>: حيث a الجزء <strong>الثابت</strong> وb الجزء <strong>المتغيّر للوحدة</strong> من التكلفة.'),
            L('R² (coefficient of determination) measures how well the model explains the variation (0 to 1).',
              '<strong>معامل التحديد R²</strong> يقيس مدى تفسير النموذج للتغيّر (من 0 إلى 1)؛ الأقرب لـ1 أفضل.'),
            L('Multiple regression uses several independent variables.',
              'الانحدار <strong>المتعدد</strong> يستخدم أكثر من متغيّر مستقل لتفسير التكلفة.'),
          ]
        },
        {
          c: '13.2', title: 'Learning Curves', ar: 'منحنى التعلّم',
          lines: [
            L('Learning curves model how average time per unit falls as cumulative output doubles.',
              'منحنى <strong>التعلّم</strong> يصف انخفاض <strong>متوسط الزمن للوحدة</strong> كلما تضاعف الإنتاج التراكمي (مثلًا 80% = الزمن يصبح 80% عند المضاعفة).'),
            L('It applies to labor-intensive, repetitive tasks and improves cost estimates.',
              'يُطبَّق على المهام <strong>المتكررة كثيفة العمالة</strong>، ويحسّن تقدير تكلفة الأوامر الجديدة.'),
          ]
        },
        {
          c: '13.3', title: 'Expected Value & Sensitivity', ar: 'القيمة المتوقعة وتحليل الحساسية',
          lines: [
            L('Expected value = Σ (probability × outcome) for decisions under uncertainty.',
              '<strong>القيمة المتوقعة = مجموع (الاحتمال × الناتج)</strong>، لاتخاذ القرار في ظل عدم التأكد.'),
            L('Sensitivity (what-if) analysis tests how results change as a key input varies.',
              'تحليل <strong>الحساسية (ماذا-لو)</strong> يختبر تغيّر النتيجة عند تغيّر متغيّر رئيسي، لتحديد أكثر العوامل تأثيرًا.'),
          ]
        },
      ]
    },

    {
      n: 14, title: 'Budget Calculations & Pro Forma', ar: 'حسابات الموازنة والقوائم التقديرية',
      domain: 'النطاق B — التخطيط والموازنات والتنبؤ (20%)',
      sections: [
        {
          c: '14.1', title: 'Sales & Production Budgets', ar: 'موازنتا المبيعات والإنتاج',
          lines: [
            L('Production (units) = budgeted sales + desired ending inventory − beginning inventory.',
              '<strong>الإنتاج المطلوب = المبيعات المقدّرة + المخزون المرغوب آخر المدة − المخزون أول المدة</strong>.'),
            L('Materials purchases = production needs + desired ending materials − beginning materials.',
              '<strong>مشتريات المواد = احتياج الإنتاج + المخزون المرغوب من المواد آخر المدة − أوله</strong>.'),
          ]
        },
        {
          c: '14.2', title: 'Cash Budget', ar: 'الموازنة النقدية',
          lines: [
            L('The cash budget projects receipts, disbursements, and financing needs by period.',
              'تتنبأ <strong>الموازنة النقدية</strong> بالمقبوضات والمدفوعات والحاجة للتمويل لكل فترة، لإدارة السيولة.'),
            L('It schedules collections from credit sales over the months they are actually received.',
              'تجدول <strong>التحصيلات</strong> من المبيعات الآجلة على أشهر القبض الفعلية (مثلًا 60% الشهر الأول، 40% التالي).'),
          ]
        },
        {
          c: '14.3', title: 'Pro Forma Financial Statements', ar: 'القوائم المالية التقديرية',
          lines: [
            L('Pro forma statements project the income statement and balance sheet under planned assumptions.',
              'القوائم <strong>التقديرية (Pro Forma)</strong> تتنبأ بقائمة الدخل والميزانية وفق افتراضات الخطة، لتقييم الأثر قبل التنفيذ.'),
            L('They let management test strategies and financing before committing resources.',
              'تتيح <strong>اختبار الاستراتيجيات والتمويل</strong> قبل التزام الموارد فعليًا.'),
          ]
        },
      ]
    },

    /* ══════════ النطاق C: إدارة الأداء (20%) — الوحدات 15-16 ══════════ */
    {
      n: 15, title: 'Cost & Variance Measures', ar: 'مقاييس التكلفة والانحرافات',
      domain: 'النطاق C — إدارة الأداء (20%)',
      sections: [
        {
          c: '15.1', title: 'Standard Costs & Variances', ar: 'التكاليف المعيارية والانحرافات',
          lines: [
            L('A standard cost is a predetermined target; a variance is the difference between actual and standard.',
              '<strong>التكلفة المعيارية</strong> هدف محدد مسبقًا، و<strong>الانحراف = الفعلي − المعياري</strong>؛ مواتٍ (F) إن خفّض التكلفة، غير موات (U) إن زادها.'),
          ]
        },
        {
          c: '15.2', title: 'Direct Material & Labor Variances', ar: 'انحرافات المواد والأجور',
          lines: [
            L('Price/rate variance = (actual price − standard price) × actual quantity.',
              '<strong>انحراف السعر/المعدل = (السعر الفعلي − المعياري) × الكمية الفعلية</strong> — للمواد سعر، وللأجور معدل الأجر.'),
            L('Quantity/efficiency variance = (actual quantity − standard quantity) × standard price.',
              '<strong>انحراف الكمية/الكفاءة = (الكمية الفعلية − المعيارية) × السعر المعياري</strong> — يقيس كفاءة الاستخدام.'),
          ]
        },
        {
          c: '15.3', title: 'Overhead Variances', ar: 'انحرافات التكاليف الصناعية',
          lines: [
            L('Variable OH splits into spending and efficiency variances.',
              'الانحراف الصناعي المتغيّر ينقسم إلى <strong>انحراف إنفاق</strong> و<strong>انحراف كفاءة</strong>.'),
            L('Fixed OH splits into spending (budget) and volume (production) variances.',
              'الانحراف الصناعي الثابت ينقسم إلى <strong>انحراف إنفاق (موازنة)</strong> و<strong>انحراف حجم</strong> ناتج عن اختلاف الإنتاج الفعلي عن المخطط.'),
          ]
        },
        {
          c: '15.4', title: 'Sales Variances', ar: 'انحرافات المبيعات',
          lines: [
            L('The sales price variance isolates the effect of selling above or below the standard price.',
              '<strong>انحراف سعر البيع</strong> يعزل أثر البيع بسعر أعلى/أقل من المعياري.'),
            L('Sales mix and quantity variances explain why total contribution differs from plan.',
              'انحرافا <strong>المزيج والكمية</strong> يفسّران اختلاف إجمالي هامش المساهمة عن الخطة (بيع منتجات بهوامش مختلفة).'),
          ]
        },
      ]
    },

    {
      n: 16, title: 'Responsibility Accounting & Performance', ar: 'محاسبة المسؤولية وقياس الأداء',
      domain: 'النطاق C — إدارة الأداء (20%)',
      sections: [
        {
          c: '16.1', title: 'Responsibility Centers', ar: 'مراكز المسؤولية',
          lines: [
            L('Managers are evaluated only on what they control: cost, revenue, profit, or investment centers.',
              'يُقيَّم المدير على ما <strong>يتحكّم فيه فقط</strong>: مركز <strong>تكلفة</strong>، <strong>إيراد</strong>، <strong>ربح</strong>، أو <strong>استثمار</strong>.'),
            L('Controllability is the key principle of responsibility accounting.',
              '<strong>القابلية للتحكم</strong> هي المبدأ الجوهري: لا تُحمِّل المدير ما لا يستطيع التأثير فيه.'),
          ]
        },
        {
          c: '16.2', title: 'ROI, Residual Income & EVA', ar: 'العائد على الاستثمار والدخل المتبقي والقيمة المضافة',
          lines: [
            L('ROI = operating income ÷ invested capital = margin × turnover (DuPont).',
              '<strong>العائد على الاستثمار = الدخل التشغيلي ÷ رأس المال المستثمر = الهامش × معدل الدوران</strong> (نموذج DuPont).'),
            L('Residual income = operating income − (required rate × invested capital), rewarding value above a hurdle.',
              '<strong>الدخل المتبقي = الدخل التشغيلي − (المعدل المطلوب × رأس المال)</strong>؛ يكافئ خلق قيمة فوق الحد الأدنى ويعالج عيب ROI في رفض مشاريع جيدة.'),
            L('EVA = after-tax operating profit − (WACC × capital), a refined residual-income measure.',
              '<strong>القيمة الاقتصادية المضافة (EVA) = الربح التشغيلي بعد الضريبة − (تكلفة رأس المال المرجّحة × رأس المال)</strong>؛ صورة مطوّرة من الدخل المتبقي.'),
          ]
        },
        {
          c: '16.3', title: 'Transfer Pricing', ar: 'أسعار التحويل',
          lines: [
            L('A transfer price is the price one segment charges another for internal transfers.',
              '<strong>سعر التحويل</strong> هو السعر الذي يتقاضاه قسم من قسم آخر داخل نفس الشركة عند التحويل الداخلي.'),
            L('Methods include market-based, cost-based, and negotiated prices.',
              'طرقه: <strong>السوق</strong> (الأمثل عند وجود سوق تنافسي)، <strong>التكلفة</strong>، أو <strong>التفاوض</strong>؛ يؤثر على ربح كل مركز وعلى تحفيز المديرين.'),
          ]
        },
        {
          c: '16.4', title: 'Balanced Scorecard', ar: 'بطاقة الأداء المتوازن',
          lines: [
            L('The balanced scorecard measures performance across four perspectives.',
              '<strong>بطاقة الأداء المتوازن</strong> تقيس الأداء عبر <strong>أربعة منظورات</strong>: المالي، العملاء، العمليات الداخلية، والتعلّم والنمو.'),
            L('It links financial and nonfinancial measures to strategy, balancing short and long term.',
              'تربط المقاييس <strong>المالية وغير المالية بالاستراتيجية</strong>، وتوازن بين الأهداف قصيرة وطويلة الأجل.'),
          ]
        },
      ]
    },

    /* ══════════ النطاق E: الرقابة الداخلية (15%) — الوحدات 17-18 ══════════ */
    {
      n: 17, title: 'Governance, Risk & Internal Control', ar: 'الحوكمة والمخاطر والرقابة الداخلية',
      domain: 'النطاق E — الرقابة الداخلية (15%)',
      sections: [
        {
          c: '17.1', title: 'Internal Control & the COSO Framework', ar: 'الرقابة الداخلية وإطار COSO',
          lines: [
            L('Internal control provides reasonable assurance over operations, reporting, and compliance.',
              'الرقابة الداخلية تقدّم <strong>تأكيدًا معقولًا</strong> (لا مطلقًا) حول كفاءة العمليات، وموثوقية التقارير، والالتزام بالأنظمة.'),
            L('COSO has five components: control environment, risk assessment, control activities, information & communication, and monitoring.',
              'إطار <strong>COSO</strong> له <strong>خمسة مكوّنات</strong>: بيئة الرقابة، تقييم المخاطر، أنشطة الرقابة، المعلومات والاتصال، والمتابعة.'),
            L('The control environment (“tone at the top”) is the foundation for all other components.',
              '<strong>بيئة الرقابة</strong> ("النبرة من القمة") هي الأساس الذي تُبنى عليه بقية المكوّنات.'),
          ]
        },
        {
          c: '17.2', title: 'Corporate Governance & SOX', ar: 'حوكمة الشركات وقانون ساربينز-أوكسلي',
          lines: [
            L('Corporate governance aligns management with stakeholders via the board and oversight.',
              '<strong>حوكمة الشركات</strong> توائم بين إدارة الشركة وأصحاب المصلحة عبر مجلس الإدارة والرقابة، لتقليل تضارب الوكالة.'),
            L('Sarbanes-Oxley requires management to assess internal control over financial reporting (Section 404).',
              '<strong>قانون SOX</strong> يُلزم الإدارة بتقييم <strong>الرقابة الداخلية على التقارير المالية</strong> (المادة 404)، ويشدّد مسؤولية المديرين التنفيذيين.'),
          ]
        },
        {
          c: '17.3', title: 'Enterprise Risk Management', ar: 'إدارة مخاطر المؤسسة',
          lines: [
            L('ERM identifies, assesses, and responds to risks across the whole entity.',
              '<strong>إدارة مخاطر المؤسسة (ERM)</strong> تحدّد وتقيّم وتعالج المخاطر على مستوى المنشأة كلها، لا قسمًا بقسم.'),
            L('Risk responses: avoid, reduce, share (transfer), or accept.',
              'استجابات المخاطر: <strong>التجنّب، التقليل، المشاركة/النقل (تأمين)، أو القبول</strong> حسب الأثر والاحتمال.'),
          ]
        },
      ]
    },

    {
      n: 18, title: 'Systems Controls & Security Measures', ar: 'ضوابط الأنظمة وإجراءات الأمن',
      domain: 'النطاق E — الرقابة الداخلية (15%)',
      sections: [
        {
          c: '18.1', title: 'General & Application Controls', ar: 'الضوابط العامة وضوابط التطبيقات',
          lines: [
            L('General controls apply to the whole IT environment; application controls govern a specific system.',
              '<strong>الضوابط العامة</strong> تشمل بيئة تقنية المعلومات كلها (الوصول، التطوير)، و<strong>ضوابط التطبيق</strong> تخص نظامًا محددًا (تحقق الإدخال، المعالجة، الإخراج).'),
            L('Input controls (e.g., validation checks) prevent errors at data entry.',
              '<strong>ضوابط الإدخال</strong> (تحقق من الصحة، حقول إجبارية) تمنع الأخطاء عند إدخال البيانات.'),
          ]
        },
        {
          c: '18.2', title: 'Segregation of Duties', ar: 'الفصل بين المهام',
          lines: [
            L('Segregate authorization, recording, and custody of assets to prevent fraud.',
              'افصل بين <strong>التفويض، التسجيل، وحفظ الأصول</strong> لمنع الاحتيال؛ فلا يجمع شخص واحد بين الصلاحيات الثلاث.'),
            L('When duties cannot be separated, compensating controls (e.g., reviews) are needed.',
              'عند تعذّر الفصل (شركات صغيرة) تُستخدم <strong>ضوابط تعويضية</strong> كالمراجعة الإشرافية والمطابقات.'),
          ]
        },
        {
          c: '18.3', title: 'Security & Business Continuity', ar: 'الأمن واستمرارية الأعمال',
          lines: [
            L('Access controls (passwords, roles, encryption) protect data confidentiality and integrity.',
              '<strong>ضوابط الوصول</strong> (كلمات مرور، صلاحيات حسب الدور، تشفير) تحمي سرية وسلامة البيانات — كنظام صلاحيات تطبيقك.'),
            L('A disaster recovery plan and regular backups ensure continuity after disruption.',
              '<strong>خطة التعافي من الكوارث</strong> والنسخ الاحتياطي المنتظم يضمنان <strong>استمرارية الأعمال</strong> بعد أي تعطّل.'),
          ]
        },
      ]
    },

    /* ══════════ النطاق F: التكنولوجيا والتحليلات (15%) — الوحدات 19-20 ══════════ */
    {
      n: 19, title: 'Information Systems & Data Governance', ar: 'نظم المعلومات وحوكمة البيانات',
      domain: 'النطاق F — التكنولوجيا والتحليلات (15%)',
      sections: [
        {
          c: '19.1', title: 'Accounting & Enterprise Systems', ar: 'النظم المحاسبية ونظم المؤسسة',
          lines: [
            L('An AIS captures, processes, and reports financial transactions.',
              '<strong>نظام المعلومات المحاسبي (AIS)</strong> يلتقط ويعالج ويُخرج المعاملات المالية في تقارير مفيدة.'),
            L('ERP unifies finance, supply chain, HR, and operations into one integrated platform.',
              '<strong>ERP</strong> يوحّد المالية وسلسلة الإمداد والموارد البشرية والعمليات في <strong>منصّة متكاملة</strong> — وهو بالضبط ما يفعله نظام GBR.'),
          ]
        },
        {
          c: '19.2', title: 'Data Governance & the Data Life Cycle', ar: 'حوكمة البيانات ودورة حياتها',
          lines: [
            L('Data governance sets policies for data quality, ownership, security, and privacy.',
              '<strong>حوكمة البيانات</strong> تضع سياسات <strong>الجودة والملكية والأمن والخصوصية</strong> لضمان موثوقية البيانات.'),
            L('The data life cycle spans capture, maintenance, use, archiving, and purging.',
              '<strong>دورة حياة البيانات</strong>: الالتقاط، الصيانة، الاستخدام، التحليل، الأرشفة، ثم الإتلاف الآمن.'),
            L('High-quality data is accurate, complete, consistent, timely, and valid.',
              'البيانات <strong>عالية الجودة</strong> دقيقة، كاملة، متسقة، في وقتها، وصحيحة.'),
          ]
        },
        {
          c: '19.3', title: 'Big Data, Cloud & Emerging Tech', ar: 'البيانات الضخمة والسحابة والتقنيات الناشئة',
          lines: [
            L('Big data is described by volume, velocity, variety, and veracity (the “Vs”).',
              '<strong>البيانات الضخمة</strong> توصف بـ: <strong>الحجم، السرعة، التنوّع، والمصداقية</strong> (الـ Vs).'),
            L('Cloud computing, blockchain, and AI/RPA reshape data storage, trust, and automation.',
              '<strong>الحوسبة السحابية</strong> (تطبيقك على Firebase مثال)، و<strong>البلوكتشين</strong> (سجل موزّع غير قابل للتلاعب)، و<strong>الذكاء الاصطناعي وأتمتة العمليات (RPA)</strong> تعيد تشكيل التخزين والثقة والأتمتة.'),
          ]
        },
      ]
    },

    {
      n: 20, title: 'Data Analytics', ar: 'تحليلات البيانات',
      domain: 'النطاق F — التكنولوجيا والتحليلات (15%)',
      sections: [
        {
          c: '20.1', title: 'Types of Data Analytics', ar: 'أنواع تحليلات البيانات',
          lines: [
            L('Descriptive analytics asks “what happened?”; diagnostic asks “why did it happen?”.',
              '<strong>التحليل الوصفي</strong> يجيب "ماذا حدث؟"، و<strong>التشخيصي</strong> يجيب "لماذا حدث؟".'),
            L('Predictive analytics asks “what will happen?”; prescriptive asks “what should we do?”.',
              '<strong>التحليل التنبؤي</strong> يجيب "ماذا سيحدث؟" (نماذج وتعلّم آلي)، و<strong>الإرشادي</strong> يجيب "ماذا ينبغي أن نفعل؟" (يوصي بأفضل إجراء).'),
          ]
        },
        {
          c: '20.2', title: 'Data Mining & Tools', ar: 'التنقيب في البيانات والأدوات',
          lines: [
            L('Data mining discovers patterns, correlations, and anomalies in large datasets.',
              '<strong>التنقيب في البيانات</strong> يكتشف الأنماط والارتباطات والشذوذ في مجموعات ضخمة من البيانات.'),
            L('Correlation does not imply causation — a key analytics caution.',
              'تحذير جوهري: <strong>الارتباط لا يعني السببية</strong>؛ وجود علاقة بين متغيّرين لا يعني أن أحدهما سبب الآخر.'),
          ]
        },
        {
          c: '20.3', title: 'Data Visualization', ar: 'تصوّر (تمثيل) البيانات',
          lines: [
            L('Visualization turns data into charts and dashboards for faster insight.',
              '<strong>تمثيل البيانات</strong> يحوّل الأرقام إلى رسوم ولوحات معلومات لفهم أسرع — كلوحات تطبيقك التحليلية.'),
            L('Choose the chart that fits the message: trends (line), comparisons (bar), composition (pie).',
              'اختر الرسم المناسب للرسالة: <strong>الاتجاهات (خطي)</strong>، <strong>المقارنات (أعمدة)</strong>، <strong>المكوّنات (دائري)</strong>؛ والوضوح أهم من الزخرفة.'),
          ]
        },
      ]
    },

  ];

  /* ════════════════════════════════════════════════════════════════
     CMA Part 2 — Strategic Financial Management (15 وحدة)
     شرح أصلي بصياغتنا. النطاقات: تحليل القوائم (20%)، التمويل المؤسسي (20%)،
     تحليل القرارات (25%)، إدارة المخاطر (10%)، قرارات الاستثمار (10%)، الأخلاقيات (15%).
     ════════════════════════════════════════════════════════════════ */
  const CURRICULUM_P2 = [

    /* ══════════ النطاق A: تحليل القوائم المالية (20%) — الوحدات 1-3 ══════════ */
    {
      n: 1, title: 'Liquidity, Solvency & Leverage Ratios', ar: 'نسب السيولة والملاءة والرافعة',
      domain: 'النطاق A — تحليل القوائم المالية (20%)',
      sections: [
        {
          c: '1.1', title: 'Common-Size & Trend Analysis', ar: 'القوائم النسبية وتحليل الاتجاه',
          lines: [
            L('Common-size statements restate each line as a percentage of a base (sales for income statement, total assets for the balance sheet).',
              'القوائم <strong>النسبية (Common-Size)</strong> تعيد صياغة كل بند كنسبة من أساس: <strong>المبيعات</strong> لقائمة الدخل و<strong>إجمالي الأصول</strong> للميزانية — لتسهيل المقارنة بين شركات بأحجام مختلفة.'),
            L('Vertical analysis compares items within one period; horizontal (trend) analysis compares one item across periods.',
              'التحليل <strong>الرأسي</strong> يقارن بنود نفس الفترة، و<strong>الأفقي/الاتجاهي</strong> يقارن البند نفسه عبر فترات (نسب اتجاه) لرصد الأنماط والنمو.'),
          ]
        },
        {
          c: '1.2', title: 'Liquidity Ratios', ar: 'نسب السيولة',
          lines: [
            L('Liquidity measures the ability to pay current obligations as they come due.',
              '<strong>السيولة</strong> = قدرة الشركة على سداد التزاماتها قصيرة الأجل عند استحقاقها (مدى سهولة تحويل الأصول لنقد).'),
            L('Current ratio = current assets ÷ current liabilities; the quick (acid-test) ratio excludes inventory and prepaids.',
              '<strong>النسبة الجارية = الأصول المتداولة ÷ الخصوم المتداولة</strong>؛ و<strong>النسبة السريعة (acid-test)</strong> تستبعد المخزون والمصروفات المقدمة لأنها أصعب تسييلًا.'),
            L('The cash ratio is the most conservative, using only cash and marketable securities.',
              '<strong>نسبة النقد</strong> أكثر تحفظًا: تستخدم النقد والأوراق المالية القابلة للتسويق فقط.'),
          ],
          note: 'نسبة جارية منخفضة = خطر إعسار محتمل؛ مرتفعة جدًا = أصول عاطلة لا تُستثمر بكفاءة. قيّمها مقابل الدورة التشغيلية للقطاع.'
        },
        {
          c: '1.3', title: 'Solvency & Capital Structure', ar: 'الملاءة وهيكل رأس المال',
          lines: [
            L('Solvency is the ability to meet long-term obligations; it depends on the mix of debt and equity.',
              '<strong>الملاءة</strong> = القدرة على الوفاء بالالتزامات طويلة الأجل، وتعتمد على <strong>مزيج الدين وحقوق الملكية</strong> ودرجة الرافعة.'),
            L('Debt-to-equity and debt-to-total-assets ratios show reliance on creditors; lower ratios mean lower risk.',
              'نسب <strong>الدين/حقوق الملكية</strong> و<strong>الدين/إجمالي الأصول</strong> تقيس الاعتماد على الدائنين؛ الأقل يعني مخاطر أقل وحماية أكبر للدائنين.'),
            L('Interest paid on debt is tax-deductible, an advantage; but debt service is a legal obligation that raises risk.',
              '<strong>فائدة الدين معفاة ضريبيًا</strong> (ميزة)، لكن خدمة الدين التزام قانوني يرفع المخاطر — فالدين لا يتقاسم السيطرة لكنه يلزم بالسداد.'),
          ]
        },
        {
          c: '1.4', title: 'Earnings Coverage & Leverage', ar: 'تغطية الأرباح والرافعة',
          lines: [
            L('Times interest earned = EBIT ÷ interest expense; it measures ability to cover interest from earnings.',
              '<strong>معدل تغطية الفائدة = EBIT ÷ مصروف الفائدة</strong> — يقيس قدرة الأرباح على تغطية الفوائد (نستخدم EBIT لا صافي الدخل).'),
            L('Operating leverage comes from fixed operating costs; financial leverage comes from fixed financing (interest).',
              '<strong>الرافعة التشغيلية</strong> تنشأ من التكاليف التشغيلية الثابتة، و<strong>المالية</strong> من تكاليف التمويل الثابتة (الفائدة).'),
            L('DOL = contribution margin ÷ operating income; DFL = EBIT ÷ EBT. High leverage magnifies both gains and losses.',
              '<strong>درجة الرافعة التشغيلية (DOL) = هامش المساهمة ÷ الدخل التشغيلي</strong>، و<strong>المالية (DFL) = EBIT ÷ الأرباح قبل الضريبة</strong>. الرافعة العالية تُضخّم الأرباح والخسائر معًا.'),
          ]
        },
      ]
    },

    {
      n: 2, title: 'Profitability & Per-Share Ratios', ar: 'نسب الربحية وربحية السهم',
      domain: 'النطاق A — تحليل القوائم المالية (20%)',
      sections: [
        {
          c: '2.1', title: 'Profitability Margins', ar: 'هوامش الربحية',
          lines: [
            L('Gross, operating, and net profit margins divide gross profit, operating income, and net income by net sales.',
              'هوامش <strong>مجمل الربح / التشغيلي / صافي الربح</strong> = (مجمل الربح / الدخل التشغيلي / صافي الدخل) ÷ صافي المبيعات — كل منها يقيس ما تبقّى بعد مستوى معيّن من التكاليف.'),
            L('EBITDA margin approximates cash profit by adding back depreciation and amortization to EBIT.',
              '<strong>هامش EBITDA</strong> يقارب الربح النقدي بإضافة الإهلاك والإطفاء إلى EBIT — مفيد للمقارنة لكنه يتجاهل احتياجات رأس المال العامل والفائدة.'),
          ]
        },
        {
          c: '2.2', title: 'Return Ratios & DuPont', ar: 'نسب العائد ونموذج DuPont',
          lines: [
            L('ROA = net income ÷ average total assets; ROE = net income ÷ average equity.',
              '<strong>العائد على الأصول (ROA) = صافي الدخل ÷ متوسط الأصول</strong>، و<strong>العائد على حقوق الملكية (ROE) = صافي الدخل ÷ متوسط حقوق الملكية</strong>.'),
            L('DuPont decomposes ROE into net profit margin × asset turnover × equity multiplier.',
              'نموذج <strong>DuPont</strong> يُفكّك ROE إلى: <strong>هامش صافي الربح × معدل دوران الأصول × مضاعف حقوق الملكية</strong> — فيكشف مصدر العائد (ربحية، كفاءة، أم رافعة).'),
            L('Sustainable growth = ROE × (1 − dividend payout); it shows growth achievable without new equity.',
              '<strong>معدل النمو المستدام = ROE × (1 − نسبة التوزيع)</strong> — النمو الممكن دون إصدار أسهم جديدة.'),
          ]
        },
        {
          c: '2.3', title: 'Per-Share & Market Ratios', ar: 'نسب السهم والسوق',
          lines: [
            L('Basic EPS = (net income − preferred dividends) ÷ weighted-average common shares.',
              '<strong>ربحية السهم الأساسية = (صافي الدخل − توزيعات الممتازة) ÷ المتوسط المرجح للأسهم العادية</strong>.'),
            L('Diluted EPS adds potential common shares (convertibles, options) when dilutive.',
              '<strong>الربحية المخفّفة</strong> تضيف الأسهم المحتملة (أدوات قابلة للتحويل، خيارات) إن كانت مُخفِّفة.'),
            L('P/E = market price ÷ EPS; book value per share, dividend payout, and dividend yield round out market analysis.',
              '<strong>مكرر الربحية = سعر السهم ÷ ربحية السهم</strong>؛ وتكمله <strong>القيمة الدفترية للسهم، نسبة التوزيع، وعائد التوزيع</strong>. مكرر مرتفع = توقعات نمو عالية.'),
          ]
        },
      ]
    },

    {
      n: 3, title: 'Activity Ratios & Earnings Quality', ar: 'نسب النشاط وجودة الأرباح',
      domain: 'النطاق A — تحليل القوائم المالية (20%)',
      sections: [
        {
          c: '3.1', title: 'Turnover & Cycle Measures', ar: 'مقاييس الدوران والدورة',
          lines: [
            L('Receivables turnover = net credit sales ÷ average receivables; days sales outstanding = 365 ÷ turnover.',
              '<strong>دوران الذمم = المبيعات الآجلة ÷ متوسط الذمم</strong>، و<strong>أيام التحصيل = 365 ÷ الدوران</strong> — دوران أعلى = تحصيل أسرع.'),
            L('Inventory turnover = COGS ÷ average inventory; payables turnover = purchases ÷ average payables.',
              '<strong>دوران المخزون = تكلفة المبيعات ÷ متوسط المخزون</strong>، و<strong>دوران الدائنين = المشتريات ÷ متوسط الدائنين</strong>.'),
            L('Operating cycle = days inventory + days receivables; cash cycle = operating cycle − days payables.',
              '<strong>الدورة التشغيلية = أيام المخزون + أيام التحصيل</strong>؛ و<strong>الدورة النقدية = التشغيلية − أيام السداد</strong> = المدة التي يُحتجز فيها النقد.'),
          ]
        },
        {
          c: '3.2', title: 'Limitations & Earnings Quality', ar: 'حدود التحليل وجودة الأرباح',
          lines: [
            L('Ratios are only useful against a benchmark: industry norm, the economy, or the firm’s own history.',
              'النسب لا تنفع إلا بالمقارنة مع <strong>معيار</strong>: متوسط القطاع، الاقتصاد، أو الأداء التاريخي للشركة نفسها.'),
            L('Earnings quality measures how useful and sustainable reported earnings are; stable, recurring earnings are higher quality.',
              '<strong>جودة الأرباح</strong> = مدى فائدة واستدامة الأرباح المعلنة؛ الأرباح <strong>المستقرة والمتكررة</strong> أعلى جودة من المتقلّبة أو العابرة.'),
            L('Ratio analysis is distorted by accounting policy differences, estimates, inflation, and seasonality.',
              'يشوّه التحليل: <strong>اختلاف السياسات المحاسبية، التقديرات، التضخّم، والموسمية</strong> — فاحذر المقارنات غير المتجانسة.'),
          ]
        },
      ]
    },

    /* ══════════ النطاق B: التمويل المؤسسي (20%) — الوحدات 4-8 ══════════ */
    {
      n: 4, title: 'Types of Securities', ar: 'أنواع الأوراق المالية',
      domain: 'النطاق B — التمويل المؤسسي (20%)',
      sections: [
        {
          c: '4.1', title: 'Bonds & Valuation', ar: 'السندات وتقييمها',
          lines: [
            L('A bond pays periodic coupon interest (stated rate × face) and repays face value at maturity.',
              'السند يدفع فائدة كوبون دورية (<strong>السعر الاسمي × القيمة الاسمية</strong>) ويردّ القيمة الاسمية عند الاستحقاق.'),
            L('A bond’s price = present value of coupons + present value of face, discounted at the market (effective) rate.',
              '<strong>سعر السند = القيمة الحالية للكوبونات + القيمة الحالية للاسمية</strong>، مخصومةً بسعر السوق (الفعّال).'),
            L('If coupon > market rate the bond sells at a premium; if coupon < market rate, at a discount.',
              'إذا كان <strong>الكوبون أعلى من سعر السوق</strong> يُباع بعلاوة، وإذا كان <strong>أقل</strong> يُباع بخصم، وإذا تساويا فبالقيمة الاسمية.'),
          ]
        },
        {
          c: '4.2', title: 'Bond Features & Ratings', ar: 'خصائص السندات وتصنيفها',
          lines: [
            L('Indentures, covenants, call provisions, and sinking funds define the bondholder’s protections and the issuer’s obligations.',
              '<strong>عقد الإصدار (Indenture)</strong> و<strong>التعهدات (Covenants)</strong> و<strong>شرط الاستدعاء</strong> و<strong>صندوق السداد (Sinking Fund)</strong> تحدد حماية حامل السند والتزامات المُصدِر.'),
            L('Investment-grade bonds (e.g., AAA–BBB) are safer; bonds rated BB or below are speculative “junk” bonds.',
              'السندات <strong>الاستثمارية</strong> (AAA–BBB) أكثر أمانًا، و<strong>BB وأقل = سندات عالية المخاطر/العائد (junk)</strong>. أطول أجلًا = عائد أعلى مقابل مخاطر أعلى.'),
          ]
        },
        {
          c: '4.3', title: 'Stock & Dividends', ar: 'الأسهم والتوزيعات',
          lines: [
            L('Common stock carries voting rights and a residual, uncertain return; preferred stock is a debt-equity hybrid with priority dividends.',
              'السهم <strong>العادي</strong> له حق تصويت وعائد متبق غير مضمون؛ و<strong>الممتاز</strong> هجين بين الدين والملكية له أولوية في التوزيع لكن غالبًا بلا تصويت.'),
            L('Key dividend dates: declaration, ex-dividend, record, and payment; the price drops on the ex-dividend date.',
              'تواريخ التوزيع: <strong>الإعلان، قبل التوزيع (ex-dividend)، التسجيل، الدفع</strong>. يهبط سعر السهم في تاريخ ex-dividend بمقدار التوزيع.'),
            L('A stock split changes share count and price but not total equity; a stock dividend reclassifies retained earnings.',
              '<strong>تجزئة السهم</strong> تغيّر العدد والسعر دون تغيير إجمالي حقوق الملكية، و<strong>توزيع الأسهم</strong> يحوّل مبلغًا من الأرباح المحتجزة إلى رأس المال.'),
          ]
        },
      ]
    },

    {
      n: 5, title: 'Financial Markets & Financing', ar: 'الأسواق المالية والتمويل',
      domain: 'النطاق B — التمويل المؤسسي (20%)',
      sections: [
        {
          c: '5.1', title: 'Markets & Efficiency', ar: 'الأسواق وكفاءتها',
          lines: [
            L('Money markets trade short-term debt (<1 year); capital markets trade long-term debt and equity.',
              '<strong>سوق النقد</strong> يتداول ديونًا قصيرة (أقل من سنة)، و<strong>سوق رأس المال</strong> يتداول ديونًا طويلة وأسهمًا.'),
            L('Primary markets raise new capital for the issuer; secondary markets trade existing securities among investors.',
              '<strong>السوق الأولية</strong> تجمع رأس مال جديد للمُصدِر، و<strong>الثانوية</strong> تتداول أوراقًا قائمة بين المستثمرين.'),
            L('The efficient markets hypothesis (weak, semi-strong, strong) holds prices reflect available information.',
              'فرضية <strong>كفاءة السوق</strong> بأشكالها (ضعيف، شبه قوي، قوي) ترى أن الأسعار تعكس المعلومات المتاحة، فيصعب تحقيق عوائد غير عادية باستمرار.'),
          ]
        },
        {
          c: '5.2', title: 'Risk, Return & CAPM', ar: 'المخاطر والعائد ونموذج CAPM',
          lines: [
            L('Systematic (market) risk is undiversifiable; unsystematic (company) risk is reduced by diversification.',
              'المخاطر <strong>المنتظمة (السوق)</strong> لا يمكن تنويعها، و<strong>غير المنتظمة (الشركة)</strong> تُخفّض بالتنويع.'),
            L('CAPM: required return = risk-free rate + β × (market return − risk-free rate).',
              '<strong>نموذج CAPM: العائد المطلوب = العائد الخالي من المخاطر + β × (عائد السوق − الخالي من المخاطر)</strong>. β يقيس حساسية السهم لحركة السوق.'),
            L('A beta of 1 moves with the market; >1 is more volatile, <1 less volatile.',
              '<strong>بيتا = 1</strong> يتحرك مع السوق، <strong>أكبر من 1</strong> أكثر تقلّبًا، <strong>أقل من 1</strong> أقل تقلّبًا.'),
          ]
        },
        {
          c: '5.3', title: 'Short & Long-Term Financing', ar: 'التمويل القصير والطويل',
          lines: [
            L('Trade credit (e.g., 2/10 net 30) is spontaneous financing; passing up the discount has a high effective annual cost.',
              '<strong>الائتمان التجاري</strong> (مثل 2/10 صافي 30) تمويل تلقائي، لكن <strong>تفويت الخصم</strong> تكلفته السنوية الفعّالة مرتفعة جدًا.'),
            L('The effective rate on a discounted loan = stated rate ÷ (1 − stated rate); compensating balances raise it too.',
              '<strong>السعر الفعّال للقرض المخصوم = السعر المعلن ÷ (1 − السعر المعلن)</strong>؛ و<strong>الرصيد المعوّض</strong> يرفع السعر الفعّال أيضًا لأن المتاح أقل.'),
            L('Commercial paper, bankers’ acceptances, and lines of credit are common short-term sources.',
              'مصادر قصيرة شائعة: <strong>الأوراق التجارية، القبولات المصرفية، وخطوط الائتمان</strong> (مع رسم ارتباط على الجزء غير المستخدم).'),
          ]
        },
      ]
    },

    {
      n: 6, title: 'Valuation & Cost of Capital', ar: 'التقييم وتكلفة رأس المال',
      domain: 'النطاق B — التمويل المؤسسي (20%)',
      sections: [
        {
          c: '6.1', title: 'Stock Valuation Models', ar: 'نماذج تقييم الأسهم',
          lines: [
            L('The constant-growth dividend model: value = next dividend ÷ (required return − growth rate).',
              'نموذج <strong>نمو التوزيعات الثابت: القيمة = التوزيع المتوقع ÷ (العائد المطلوب − معدل النمو)</strong>.'),
            L('Preferred stock with a fixed dividend: value = dividend ÷ required return.',
              'تقييم <strong>السهم الممتاز</strong> ذي التوزيع الثابت: <strong>القيمة = التوزيع ÷ العائد المطلوب</strong>.'),
            L('Two-stage models discount high-growth dividends separately, then add the terminal value.',
              'النماذج <strong>ثنائية المراحل</strong> تخصم توزيعات مرحلة النمو العالي منفصلة، ثم تضيف القيمة النهائية لمرحلة النمو المستقر.'),
          ]
        },
        {
          c: '6.2', title: 'WACC & Optimal Structure', ar: 'المتوسط المرجح والهيكل الأمثل',
          lines: [
            L('Component cost of debt = effective rate × (1 − tax rate); equity costs more because it is riskier.',
              '<strong>تكلفة الدين = السعر الفعّال × (1 − معدل الضريبة)</strong>؛ وتكلفة حقوق الملكية أعلى لأنها أكثر مخاطرة (لا التزام قانوني بالعائد).'),
            L('WACC = the weighted average of component costs, using market-value weights.',
              '<strong>المتوسط المرجح لتكلفة رأس المال (WACC)</strong> = متوسط مرجّح لتكاليف المكوّنات بأوزان <strong>القيمة السوقية</strong> لا الدفترية.'),
            L('The optimal capital structure minimizes WACC, which maximizes firm value; this is the right hurdle for projects.',
              '<strong>الهيكل الأمثل</strong> هو الذي يُدنّي WACC ويُعظّم قيمة الشركة. تُقبل المشاريع التي يفوق عائدها WACC.'),
          ]
        },
        {
          c: '6.3', title: 'Derivatives & Hedging', ar: 'المشتقات والتحوّط',
          lines: [
            L('A derivative’s value derives from an underlying (stock, currency, commodity); one party hedges, the other speculates.',
              'قيمة <strong>المشتق</strong> مشتقّة من أصل أساسي (سهم، عملة، سلعة)؛ طرف <strong>يتحوّط</strong> (يتجنّب المخاطر) وآخر <strong>يضارب</strong>.'),
            L('A call option gives the right to buy; a put gives the right to sell, both at the strike price.',
              'خيار <strong>الشراء (call)</strong> يعطي حق الشراء، و<strong>البيع (put)</strong> يعطي حق البيع، كلاهما بسعر التنفيذ. الحامل يختار التنفيذ، والكاتب مُلزم.'),
            L('Forwards/futures lock a price for both parties; swaps exchange cash-flow streams (interest or currency).',
              '<strong>العقود الآجلة/المستقبلية</strong> تثبّت السعر للطرفين معًا (إلزام)، و<strong>المبادلات (swaps)</strong> تبادل تدفقات نقدية (فائدة أو عملة).'),
          ]
        },
      ]
    },

    {
      n: 7, title: 'Working Capital Management', ar: 'إدارة رأس المال العامل',
      domain: 'النطاق B — التمويل المؤسسي (20%)',
      sections: [
        {
          c: '7.1', title: 'Working Capital Policy', ar: 'سياسة رأس المال العامل',
          lines: [
            L('Net working capital = current assets − current liabilities; the goal is to balance liquidity against the cost of holding it.',
              '<strong>رأس المال العامل الصافي = الأصول المتداولة − الخصوم المتداولة</strong>؛ الهدف موازنة السيولة مقابل تكلفة الاحتفاظ بها.'),
            L('A conservative policy holds more current assets (higher liquidity, lower return); an aggressive policy holds less.',
              'السياسة <strong>المتحفظة</strong> تحتفظ بمزيد من الأصول المتداولة (سيولة أعلى، عائد أقل)، و<strong>الجريئة</strong> بالعكس (ربحية أعلى، مخاطرة أعلى).'),
          ]
        },
        {
          c: '7.2', title: 'Cash & Marketable Securities', ar: 'النقد والأوراق القابلة للتسويق',
          lines: [
            L('Motives for holding cash: transactional, precautionary, and speculative; minimize idle cash since it earns no return.',
              'دوافع الاحتفاظ بالنقد: <strong>المعاملات، الاحتياط، المضاربة</strong>؛ ويُقلَّل النقد العاطل لأنه لا يحقق عائدًا.'),
            L('Speeding collections (lockbox, concentration banking) and slowing disbursements (float) improve cash position.',
              '<strong>تسريع التحصيل</strong> (صندوق البريد، التركيز البنكي) و<strong>إبطاء المدفوعات</strong> (الـ float) يحسّنان وضع النقد. وازن المنفعة مقابل الرسوم.'),
            L('Idle cash is parked in safe, liquid instruments (T-bills, CDs, repos, commercial paper).',
              'يُستثمر النقد الفائض في أدوات <strong>آمنة وسائلة</strong>: أذون الخزانة، شهادات الإيداع، اتفاقيات إعادة الشراء، الأوراق التجارية.'),
          ]
        },
        {
          c: '7.3', title: 'Receivables & Inventory', ar: 'الذمم والمخزون',
          lines: [
            L('Credit policy balances increased sales against bad-debt risk and the opportunity cost of funds tied in receivables.',
              'سياسة <strong>الائتمان</strong> توازن زيادة المبيعات مقابل مخاطر الديون المعدومة وتكلفة الفرصة للأموال المحتجزة في الذمم.'),
            L('Inventory costs are purchase, carrying, ordering, and stockout costs; the EOQ minimizes ordering plus carrying cost.',
              'تكاليف المخزون: <strong>الشراء، الاحتفاظ، الطلب، نفاد المخزون</strong>؛ و<strong>كمية الطلب الاقتصادية (EOQ)</strong> تُدنّي مجموع تكلفتي الطلب والاحتفاظ.'),
            L('Higher demand or order cost raises EOQ; higher carrying cost lowers it.',
              'زيادة الطلب أو تكلفة الأمر <strong>ترفع EOQ</strong>، وزيادة تكلفة الاحتفاظ <strong>تخفضها</strong>. وتُحدَّد سياسة المخزون الاحتياطي حسب تقلّب الطلب.'),
          ]
        },
      ]
    },

    {
      n: 8, title: 'Restructuring & International Finance', ar: 'إعادة الهيكلة والتمويل الدولي',
      domain: 'النطاق B — التمويل المؤسسي (20%)',
      sections: [
        {
          c: '8.1', title: 'Mergers & Acquisitions', ar: 'الاندماج والاستحواذ',
          lines: [
            L('Mergers are horizontal (same business), vertical (supplier/customer), or conglomerate (unrelated).',
              'الاندماج <strong>أفقي</strong> (نفس النشاط)، <strong>رأسي</strong> (مورّد/عميل)، أو <strong>تكتّلي</strong> (أنشطة غير مرتبطة).'),
            L('Synergy means the combined firm is worth more than the sum of the parts (operational or financial).',
              '<strong>التآزر (Synergy)</strong> = قيمة الكيان المدمج أكبر من مجموع أجزائه (تآزر تشغيلي أو مالي). الاستحواذ يُقيَّم بطريقة التدفقات المخصومة.'),
            L('Takeover defenses include poison pills, golden parachutes, white knights, and leveraged recapitalization.',
              'دفاعات الاستحواذ العدائي: <strong>حبة السم، المظلة الذهبية، الفارس الأبيض، إعادة الرسملة بالرافعة</strong>.'),
          ]
        },
        {
          c: '8.2', title: 'Exchange Rates & Risk', ar: 'أسعار الصرف والمخاطر',
          lines: [
            L('The spot rate is for today; the forward rate is for a set future date. A forward premium/discount signals expected appreciation/depreciation.',
              '<strong>السعر الفوري</strong> لليوم، و<strong>الآجل</strong> لتاريخ مستقبلي محدد. <strong>العلاوة/الخصم الآجل</strong> يشير لتوقّع ارتفاع/انخفاض العملة.'),
            L('Transaction exposure: a foreign-denominated receivable risks the currency depreciating; a payable risks it appreciating.',
              '<strong>تعرّض المعاملة</strong>: الذمم بعملة أجنبية تخاطر بانخفاض تلك العملة، والذمم الدائنة تخاطر بارتفاعها.'),
            L('Hedge a receivable by selling the currency forward; hedge a payable by buying it forward.',
              'تحوّط <strong>الذمم المدينة</strong> ببيع العملة آجلًا، و<strong>الدائنة</strong> بشراء العملة آجلًا — لتثبيت السعر وتجنّب التقلّب.'),
          ]
        },
      ]
    },

    /* ══════════ النطاق C: تحليل القرارات (25%) — الوحدات 9-11 ══════════ */
    {
      n: 9, title: 'Cost-Volume-Profit (CVP) Analysis', ar: 'تحليل التكلفة–الحجم–الربح',
      domain: 'النطاق C — تحليل القرارات (25%)',
      sections: [
        {
          c: '9.1', title: 'Contribution Margin & Breakeven', ar: 'هامش المساهمة ونقطة التعادل',
          lines: [
            L('Unit contribution margin (UCM) = price − unit variable cost; the contribution margin ratio = UCM ÷ price.',
              '<strong>هامش المساهمة للوحدة = السعر − التكلفة المتغيّرة للوحدة</strong>، و<strong>نسبة هامش المساهمة = الهامش ÷ السعر</strong>.'),
            L('Breakeven units = fixed costs ÷ UCM; breakeven sales = fixed costs ÷ contribution margin ratio.',
              '<strong>نقطة التعادل بالوحدات = التكاليف الثابتة ÷ هامش المساهمة للوحدة</strong>، و<strong>بالقيمة = الثابتة ÷ نسبة الهامش</strong> — عندها الربح = صفر.'),
          ]
        },
        {
          c: '9.2', title: 'Target Income & Margin of Safety', ar: 'الربح المستهدف وهامش الأمان',
          lines: [
            L('Target-income units = (fixed costs + target operating income) ÷ UCM; for after-tax, divide target by (1 − tax rate).',
              '<strong>وحدات الربح المستهدف = (الثابتة + الربح التشغيلي المستهدف) ÷ هامش المساهمة</strong>؛ ولربح <strong>بعد الضريبة</strong> اقسمه على (1 − معدل الضريبة).'),
            L('Margin of safety = planned sales − breakeven sales; it shows how far sales can fall before a loss.',
              '<strong>هامش الأمان = المبيعات المخططة − مبيعات التعادل</strong> — كم يمكن أن تنخفض المبيعات قبل تحقّق خسارة.'),
          ]
        },
        {
          c: '9.3', title: 'Multi-Product CVP', ar: 'تعدّد المنتجات',
          lines: [
            L('With multiple products, use the weighted-average UCM based on the sales mix.',
              'مع تعدّد المنتجات نستخدم <strong>المتوسط المرجح لهامش المساهمة</strong> حسب <strong>مزيج المبيعات</strong>.'),
            L('There is no unique breakeven point; it shifts with the sales mix — more high-margin product lowers breakeven.',
              'لا توجد نقطة تعادل وحيدة؛ تتغيّر مع <strong>مزيج المبيعات</strong> — بيع مزيد من المنتج عالي الهامش يخفض التعادل.'),
          ]
        },
      ]
    },

    {
      n: 10, title: 'Marginal Analysis', ar: 'التحليل الحدّي',
      domain: 'النطاق C — تحليل القرارات (25%)',
      sections: [
        {
          c: '10.1', title: 'Relevant Costs & Profit Max', ar: 'التكاليف الملائمة وتعظيم الربح',
          lines: [
            L('Profit is maximized where marginal revenue equals marginal cost.',
              'يتعظّم الربح عند تساوي <strong>الإيراد الحدّي مع التكلفة الحدّية (MR = MC)</strong>.'),
            L('Relevant costs are future and differ between alternatives; sunk costs are always irrelevant.',
              'التكاليف <strong>الملائمة</strong> مستقبلية وتختلف بين البدائل؛ و<strong>التكاليف الغارقة (sunk) غير ملائمة دائمًا</strong>. تجاهل أيضًا التكاليف غير القابلة للتجنّب.'),
            L('Economic cost includes implicit opportunity cost, so accounting profit can exceed economic profit.',
              'التكلفة <strong>الاقتصادية</strong> تشمل تكلفة الفرصة الضمنية، لذا قد يفوق <strong>الربح المحاسبي الربح الاقتصادي</strong> (وقد يكون هناك خسارة اقتصادية رغم ربح محاسبي).'),
          ]
        },
        {
          c: '10.2', title: 'Special Orders & Make-or-Buy', ar: 'الطلبات الخاصة والصنع أو الشراء',
          lines: [
            L('With idle capacity, accept a special order if price ≥ variable cost; fixed costs are irrelevant.',
              'مع <strong>طاقة عاطلة</strong>، اقبل الطلب الخاص إذا كان السعر ≥ التكلفة المتغيّرة؛ والتكاليف الثابتة غير ملائمة.'),
            L('Without idle capacity, add the opportunity cost (lost contribution margin) to the minimum price.',
              'بدون طاقة عاطلة، أضف <strong>تكلفة الفرصة</strong> (هامش المساهمة المفقود من إنتاج آخر) إلى السعر الأدنى المقبول.'),
            L('Make-or-buy: make in-house if total relevant (avoidable) cost < purchase price.',
              'قرار <strong>الصنع أو الشراء</strong>: اصنع داخليًا إذا كانت التكلفة الملائمة (القابلة للتجنّب) أقل من سعر الشراء؛ وراعِ تكلفة الفرصة للطاقة.'),
          ]
        },
        {
          c: '10.3', title: 'Sell-or-Process & Keep-or-Drop', ar: 'البيع أو المعالجة والإبقاء أو الإلغاء',
          lines: [
            L('Sell or process further: joint cost is sunk; process further only if incremental revenue > incremental cost.',
              '<strong>البيع أو المعالجة الإضافية</strong>: التكلفة المشتركة غارقة؛ عالِج إضافيًا فقط إذا كان الإيراد الإضافي > التكلفة الإضافية.'),
            L('Keep or drop a segment: compare fixed-cost savings to lost contribution margin (including effects on other segments).',
              '<strong>الإبقاء أو الإلغاء</strong>: قارن وفر التكاليف الثابتة بهامش المساهمة المفقود (مع أثر القرار على القطاعات الأخرى). تجاهل التكاليف الموزّعة غير القابلة للتجنّب.'),
          ]
        },
      ]
    },

    {
      n: 11, title: 'Pricing Analysis', ar: 'تحليل التسعير',
      domain: 'النطاق C — تحليل القرارات (25%)',
      sections: [
        {
          c: '11.1', title: 'Elasticity & Market Structures', ar: 'المرونة وهياكل السوق',
          lines: [
            L('Price elasticity of demand = %Δ quantity ÷ %Δ price; elastic (>1) means demand is price-sensitive.',
              '<strong>مرونة الطلب السعرية = التغيّر % في الكمية ÷ التغيّر % في السعر</strong>؛ <strong>مرن (أكبر من 1)</strong> = الطلب حساس للسعر.'),
            L('In elastic demand a price cut raises total revenue; in inelastic demand a price rise raises revenue.',
              'في الطلب <strong>المرن</strong>: خفض السعر يرفع الإيراد الكلي؛ وفي <strong>غير المرن</strong>: رفع السعر يرفع الإيراد.'),
            L('Market structures: pure competition, monopolistic competition, oligopoly, monopoly — each affects pricing power.',
              'هياكل السوق: <strong>المنافسة التامة، الاحتكارية، احتكار القلة، الاحتكار</strong> — كلٌّ يحدد قدرة الشركة على التسعير.'),
          ]
        },
        {
          c: '11.2', title: 'Pricing Approaches', ar: 'مناهج التسعير',
          lines: [
            L('Cost-plus pricing adds a markup to cost; market/value pricing starts from customers’ perceived value and competitors.',
              'التسعير <strong>بالتكلفة المضافة</strong> يضيف هامش ربح للتكلفة؛ و<strong>التسعير السوقي/القيمي</strong> يبدأ من القيمة المُدرَكة لدى العميل وأسعار المنافسين.'),
            L('New-product strategies: price skimming (high initial price) vs. penetration pricing (low initial price).',
              'استراتيجيات المنتج الجديد: <strong>القشط (سعر مبدئي مرتفع)</strong> مقابل <strong>الاختراق (سعر مبدئي منخفض)</strong> لاكتساب حصة سريعة.'),
          ]
        },
        {
          c: '11.3', title: 'Target Costing & Life Cycle', ar: 'التكلفة المستهدفة ودورة الحياة',
          lines: [
            L('Target cost = market price − desired profit; value engineering reduces cost to meet the target.',
              '<strong>التكلفة المستهدفة = سعر السوق − الربح المطلوب</strong>؛ وتُستخدم <strong>هندسة القيمة</strong> لخفض التكلفة للوصول إليها.'),
            L('Life-cycle costing covers all costs from R&D to disposal; whole-life cost adds the customer’s after-purchase costs.',
              'تكاليف <strong>دورة الحياة</strong> تشمل كل التكاليف من البحث للتخلّص؛ و<strong>تكلفة العمر الكامل</strong> تضيف تكاليف العميل بعد الشراء (تشغيل، صيانة).'),
            L('Illegal pricing includes predatory pricing, price discrimination (Robinson-Patman), collusion, and dumping.',
              'التسعير <strong>غير القانوني</strong>: التسعير الافتراسي، التمييز السعري (روبنسون-باتمان)، التواطؤ، والإغراق (dumping).'),
          ]
        },
      ]
    },

    /* ══════════ النطاق D: إدارة المخاطر (10%) — الوحدة 12 ══════════ */
    {
      n: 12, title: 'Enterprise Risk Management (ERM)', ar: 'إدارة مخاطر المؤسسة',
      domain: 'النطاق D — إدارة المخاطر (10%)',
      sections: [
        {
          c: '12.1', title: 'Types & Process of Risk', ar: 'أنواع المخاطر وعمليتها',
          lines: [
            L('Risk types: hazard (insurable), financial, operational, strategic, and business risk.',
              'أنواع المخاطر: <strong>الخطر (قابل للتأمين)، المالية، التشغيلية، الاستراتيجية، ومخاطر الأعمال</strong>.'),
            L('The risk process: identify, assess (probability × impact), prioritize, respond, and monitor.',
              'عملية المخاطر: <strong>التحديد، التقييم (الاحتمال × الأثر)، الترتيب، الاستجابة، المتابعة</strong>. القيمة المتوقعة للخسارة = الاحتمال × الأثر.'),
          ]
        },
        {
          c: '12.2', title: 'Risk Responses & COSO ERM', ar: 'استجابات المخاطر وإطار COSO',
          lines: [
            L('Responses: acceptance, avoidance, reduction (mitigation), sharing (transfer), and pursuit/exploitation.',
              'الاستجابات: <strong>القبول، التجنّب، التقليل، المشاركة/النقل (تأمين)، والاستغلال</strong> حسب التكرار والشدة.'),
            L('Risk appetite ≤ risk capacity; tolerance is the acceptable range of variation in performance.',
              '<strong>الرغبة في المخاطرة ≤ القدرة على تحمّلها</strong>؛ و<strong>التحمّل (Tolerance)</strong> = المدى المقبول لانحراف الأداء.'),
            L('COSO ERM has 5 components: governance & culture, strategy & objective-setting, performance, review & revision, and information & communication.',
              'إطار <strong>COSO لإدارة مخاطر المؤسسة</strong> له <strong>خمسة مكوّنات</strong>: الحوكمة والثقافة، الاستراتيجية وتحديد الأهداف، الأداء، المراجعة والتنقيح، المعلومات والاتصال.'),
          ]
        },
      ]
    },

    /* ══════════ النطاق E: قرارات الاستثمار (10%) — الوحدة 13 ══════════ */
    {
      n: 13, title: 'Capital Investment Decisions', ar: 'قرارات الاستثمار الرأسمالي',
      domain: 'النطاق E — قرارات الاستثمار الرأسمالي (10%)',
      sections: [
        {
          c: '13.1', title: 'Relevant Cash Flows', ar: 'التدفقات النقدية الملائمة',
          lines: [
            L('Evaluate projects on after-tax cash flows: net initial investment, annual operating flows, and terminal flows.',
              'تُقيَّم المشاريع على <strong>التدفقات بعد الضريبة</strong>: <strong>الاستثمار المبدئي الصافي، التدفقات التشغيلية السنوية، وتدفقات نهاية المشروع</strong>.'),
            L('The depreciation tax shield = depreciation × tax rate; it adds cash even though depreciation is non-cash.',
              '<strong>وقاء الإهلاك الضريبي = الإهلاك × معدل الضريبة</strong> — يضيف نقدًا رغم أن الإهلاك بند غير نقدي. والتغيّر في رأس المال العامل يُسترد آخر المشروع.'),
          ]
        },
        {
          c: '13.2', title: 'NPV, IRR & Discounting', ar: 'صافي القيمة الحالية ومعدل العائد الداخلي',
          lines: [
            L('NPV discounts net cash flows at the hurdle rate; accept if NPV > 0.',
              '<strong>صافي القيمة الحالية (NPV)</strong> يخصم التدفقات بمعدل العائد المطلوب؛ يُقبل المشروع إذا كان <strong>NPV أكبر من صفر</strong>.'),
            L('IRR is the rate that makes NPV = 0; accept if IRR > the required rate.',
              '<strong>معدل العائد الداخلي (IRR)</strong> هو المعدل الذي يجعل NPV = صفر؛ يُقبل إذا تجاوز العائد المطلوب.'),
            L('Prefer NPV for mutually exclusive projects — it measures absolute value added and avoids IRR’s pitfalls.',
              'فضّل <strong>NPV</strong> للمشاريع المتنافية لأنه يقيس القيمة المضافة المطلقة ويتجنّب مشاكل IRR (تعدّد المعدلات، اختلاف الحجم والتوقيت).'),
          ]
        },
        {
          c: '13.3', title: 'Payback, PI & Real Options', ar: 'الاسترداد ومؤشر الربحية والخيارات الحقيقية',
          lines: [
            L('Payback period ignores the time value of money; discounted payback corrects this but still ignores later flows.',
              '<strong>فترة الاسترداد</strong> تتجاهل القيمة الزمنية للنقود؛ و<strong>المخصومة</strong> تعالجها لكنها تتجاهل التدفقات بعد فترة القطع.'),
            L('Profitability index = PV of cash flows ÷ initial investment; use it to rank projects under capital rationing.',
              '<strong>مؤشر الربحية = القيمة الحالية للتدفقات ÷ الاستثمار المبدئي</strong> — لترتيب المشاريع عند <strong>تقنين رأس المال</strong> (قبول إن كان > 1).'),
            L('Real options (abandon, delay, expand, scale back) add flexibility and value to a project.',
              '<strong>الخيارات الحقيقية</strong> (التخلّي، التأجيل، التوسّع، التقليص) تضيف مرونة وقيمة للمشروع، وغالبًا رخيصة الإضافة وعالية الفائدة.'),
          ]
        },
      ]
    },

    /* ══════════ النطاق F: الأخلاقيات المهنية (15%) — الوحدتان 14-15 ══════════ */
    {
      n: 14, title: 'Ethics for Professionals', ar: 'أخلاقيات المهنيين',
      domain: 'النطاق F — الأخلاقيات المهنية (15%)',
      sections: [
        {
          c: '14.1', title: 'IMA Ethics & Conflicts of Interest', ar: 'أخلاقيات IMA وتعارض المصالح',
          lines: [
            L('The IMA Statement has four principles (honesty, fairness, objectivity, responsibility) and four standards (competence, confidentiality, integrity, credibility).',
              'بيان <strong>IMA للأخلاقيات</strong> فيه <strong>أربعة مبادئ</strong>: الأمانة، العدل، الموضوعية، المسؤولية؛ و<strong>أربعة معايير</strong>: الكفاءة، السرّية، النزاهة، المصداقية.'),
            L('To resolve issues, follow company policy first; escalate up the chain or seek the IMA helpline and legal advice.',
              'لحلّ المشكلة الأخلاقية: اتّبع سياسة الشركة أولًا، ثم تصعيدها للمستوى الأعلى، أو خط مساعدة IMA، أو استشارة قانونية — وقد يصل الأمر للانفصال عن المنظمة.'),
            L('A conflict of interest impairs objectivity; mitigate actual conflicts and disclose potential ones.',
              '<strong>تعارض المصالح</strong> يُضعف الموضوعية؛ يجب <strong>تخفيف</strong> التعارض الفعلي و<strong>الإفصاح</strong> عن المحتمل وتجنّب الهدايا المؤثّرة.'),
          ]
        },
        {
          c: '14.2', title: 'Fraud & the Fraud Triangle', ar: 'الاحتيال ومثلث الاحتيال',
          lines: [
            L('Two fraud types: fraudulent financial reporting (usually management) and misappropriation of assets (usually employees).',
              'نوعا الاحتيال: <strong>التقارير المالية الاحتيالية</strong> (غالبًا الإدارة) و<strong>اختلاس الأصول</strong> (غالبًا الموظفون).'),
            L('The fraud triangle: opportunity, rationalization, and pressure (motivation).',
              '<strong>مثلث الاحتيال</strong>: <strong>الفرصة، التبرير، الضغط (الدافع)</strong> — وجود الثلاثة يرفع خطر الاحتيال بشدة.'),
            L('Only opportunity is directly controllable by the organization — through strong internal controls.',
              '<strong>الفرصة</strong> وحدها هي ما يمكن للمنظمة التحكّم فيه مباشرةً — عبر رقابة داخلية قوية. وتُؤثّر على التبرير بثقافة أخلاقية ومدوّنة سلوك.'),
          ]
        },
      ]
    },

    {
      n: 15, title: 'Ethics for the Organization', ar: 'أخلاقيات المنظمة',
      domain: 'النطاق F — الأخلاقيات المهنية (15%)',
      sections: [
        {
          c: '15.1', title: 'Anti-Bribery Laws (FCPA & UKBA)', ar: 'قوانين مكافحة الرشوة',
          lines: [
            L('The U.S. FCPA prohibits bribing foreign officials and requires accurate books and internal controls.',
              'قانون <strong>FCPA الأمريكي</strong> يحظر رشوة المسؤولين الأجانب ويُلزم بدفاتر دقيقة ورقابة داخلية كافية (يحظر العرض حتى لو لم يُنفّذ).'),
            L('The UK Bribery Act is broader — it also covers commercial bribery, passive bribery, and failure to prevent bribery.',
              'قانون <strong>الرشوة البريطاني (UKBA)</strong> أوسع: يشمل الرشوة التجارية، الرشوة السلبية (التلقّي)، والفشل في منع الرشوة — وله ولاية قضائية عالمية واسعة.'),
          ]
        },
        {
          c: '15.2', title: 'Corporate Responsibility & Data Ethics', ar: 'المسؤولية المؤسسية وأخلاقيات البيانات',
          lines: [
            L('A code of conduct, “tone at the top,” training, and a whistleblowing hotline build an ethical culture.',
              '<strong>مدوّنة سلوك</strong>، و<strong>القدوة من القمة</strong>، والتدريب، و<strong>خط الإبلاغ عن المخالفات</strong> تبني ثقافة أخلاقية (SOX يُلزم الشركات المدرجة بخط للإبلاغ).'),
            L('CSR pyramid (Carroll): economic, then legal, ethical, and philanthropic responsibilities; sustainability balances social, economic, and environmental spheres.',
              'هرم <strong>المسؤولية الاجتماعية (CSR)</strong>: <strong>اقتصادية ثم قانونية ثم أخلاقية ثم خيرية</strong>؛ و<strong>الاستدامة</strong> توازن المجالات الاجتماعية والاقتصادية والبيئية.'),
            L('Data ethics requires transparency, fairness, and privacy; laws like the EU GDPR regulate personal data.',
              '<strong>أخلاقيات البيانات</strong> تتطلب الشفافية والعدل والخصوصية؛ وتنظّم قوانين مثل <strong>GDPR الأوروبي</strong> جمع واستخدام البيانات الشخصية عالميًا.'),
          ]
        },
      ]
    },

  ];

  window.CMA_CURRICULUM = CURRICULUM;
  window.CMA_CURRICULUM_P2 = CURRICULUM_P2;

  function lineHTML(l) {
    return '<div style="background:#f0f8ff;border-right:3px solid #2980b9;border-radius:8px;padding:9px 12px;margin-bottom:5px;font-weight:700;color:#1b4f72;direction:ltr;text-align:left">'
      + escH(l.en) + '</div>'
      + '<p style="margin:0 0 13px">' + l.ar + '</p>';
  }

  function sectionHTML(s, open) {
    let h = '<details ' + (open ? 'open' : '') + ' style="border:1px solid #efe4f6;border-radius:10px;margin-bottom:10px;overflow:hidden">';
    h += '<summary style="cursor:pointer;list-style:none;padding:11px 14px;background:#f6f0fa;color:#4a235a;font-weight:800;font-size:14px">'
      + escH(s.c) + ' ' + escH(s.title) + ' — ' + escH(s.ar) + '</summary>';
    h += '<div style="padding:14px;font-size:13px;line-height:1.85;color:#222">';
    s.lines.forEach(function (l) { h += lineHTML(l); });
    if (s.note) {
      h += '<div style="background:#fff8e6;border-right:3px solid #f39c12;border-radius:8px;padding:9px 12px;margin-top:8px;font-size:12px;color:#7d5a00">💡 ' + s.note + '</div>';
    }
    h += '</div></details>';
    return h;
  }

  function unitHTML(u, open) {
    let h = '<details ' + (open ? 'open' : '') + ' style="border:1px solid #e6d6ef;border-radius:12px;margin-bottom:12px;overflow:hidden">';
    h += '<summary style="cursor:pointer;list-style:none;padding:13px 16px;background:linear-gradient(135deg,#4a235a,#9b59b6);color:#fff;font-weight:800;font-size:15px">'
      + '📘 Study Unit ' + u.n + ' — ' + escH(u.title)
      + '<span style="font-weight:400;opacity:.9;font-size:11px;display:block;margin-top:3px">الوحدة ' + u.n + ': ' + escH(u.ar) + ' • ' + escH(u.domain) + '</span>'
      + '</summary>';
    h += '<div style="padding:14px;background:#fff">';
    u.sections.forEach(function (s, i) { h += sectionHTML(s, open && i === 0); });
    h += '</div></details>';
    return h;
  }

  function partBanner(txt) {
    return '<div style="background:linear-gradient(135deg,#1b4f72,#2980b9);color:#fff;border-radius:10px;padding:12px 16px;margin:18px 0 12px;font-weight:900;font-size:16px">'
      + txt + '</div>';
  }

  function render() {
    const box = document.getElementById('cmaLessonsBox');
    if (!box) return;
    let h = '';

    h += partBanner('📊 CMA Part 1 — Financial Planning, Performance &amp; Analytics (التخطيط والأداء والتحليلات)');
    CURRICULUM.forEach(function (u, i) { h += unitHTML(u, i === 0); });
    h += '<div style="background:#eafaf1;border-right:3px solid #27ae60;border-radius:8px;padding:10px 12px;margin-top:6px;font-size:12px;color:#1e6b3a">'
      + '✅ اكتمل شرح منهج CMA Part 1 — ' + CURRICULUM.length + ' وحدة دراسية عبر النطاقات الستة. مُعاد صياغته بأسلوبنا لتسهيل المذاكرة.'
      + '</div>';

    h += partBanner('📈 CMA Part 2 — Strategic Financial Management (الإدارة المالية الاستراتيجية)');
    CURRICULUM_P2.forEach(function (u) { h += unitHTML(u, false); });
    h += '<div style="background:#eafaf1;border-right:3px solid #27ae60;border-radius:8px;padding:10px 12px;margin-top:6px;font-size:12px;color:#1e6b3a">'
      + '✅ اكتمل شرح منهج CMA Part 2 — ' + CURRICULUM_P2.length + ' وحدة دراسية عبر النطاقات الستة. مُعاد صياغته بأسلوبنا لتسهيل المذاكرة.'
      + '</div>';

    box.innerHTML = h;
  }

  window.renderCmaLessons = render;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
