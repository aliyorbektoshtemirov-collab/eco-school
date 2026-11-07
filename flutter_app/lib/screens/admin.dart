import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets.dart';
import 'admin_create.dart';
import 'recycling.dart' show materialNames;

/// Admin panel — saytdagi bo'limlarning telefon uchun ko'rinishi.
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 5, vsync: this);
  Map<String, dynamic> _summary = const {};

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _loadSummary() async {
    try {
      final res = await Api.instance.get('/admin/summary');
      if (mounted) setState(() => _summary = res);
    } catch (_) {
      // panel baribir ochilaveradi
    }
  }

  int _pending(String key) {
    final map = _summary['pending'] as Map<String, dynamic>?;
    return (map?[key] as num?)?.toInt() ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = session.user?.isOwner == true;

    return Scaffold(
      backgroundColor: Eco.bg,
      appBar: AppBar(
        title: const Text('Admin panel'),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          labelColor: Eco.green,
          unselectedLabelColor: Eco.muted,
          indicatorColor: Eco.green,
          labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          tabs: [
            Tab(text: _label('Topshiriq', _pending('challenges'))),
            Tab(text: _label('Recycling', _pending('recycling'))),
            const Tab(text: 'Vazifalar'),
            const Tab(text: 'Marafon'),
            const Tab(text: 'E’lon'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          ChallengeReview(onChanged: _loadSummary),
          RecyclingReview(onChanged: _loadSummary),
          const TaskAdmin(),
          const MarathonAdmin(),
          AnnouncementAdmin(isOwner: isOwner),
        ],
      ),
    );
  }

  String _label(String text, int count) => count > 0 ? '$text · $count' : text;
}

/* ===================================================== topshiriqlar navbati */

class ChallengeReview extends StatefulWidget {
  const ChallengeReview({super.key, required this.onChanged});

  final VoidCallback onChanged;

  @override
  State<ChallengeReview> createState() => _ChallengeReviewState();
}

class _ChallengeReviewState extends State<ChallengeReview> {
  List<dynamic> _items = const [];
  String _filter = 'pending';
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await Api.instance.get('/challenges/admin/list');
      setState(() => _items = res['items'] as List? ?? const []);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _review(Map<String, dynamic> item, String status) async {
    final points = (item['challenge_points'] as num?)?.toInt() ?? 0;

    final yes = await confirm(
      context,
      title: status == 'approved' ? '+$points ball berilsinmi?' : 'Rad etilsinmi?',
      body: item['full_name'] as String?,
      yes: status == 'approved' ? 'Tasdiqlash' : 'Rad etish',
      danger: status != 'approved',
    );
    if (!yes) return;

    setState(() => _busy = true);
    try {
      final id = (item['id'] as num).toInt();
      final res = await Api.instance
          .post('/challenges/admin/$id/review', {'status': status});
      if (mounted) showNote(context, res['message'] as String? ?? 'Saqlandi.');
      await _load();
      widget.onChanged();
    } on ApiException catch (e) {
      if (mounted) showNote(context, e.message, error: true);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Loading();
    if (_error != null) return ErrorNote(message: _error!, onRetry: _load);

    final shown = _items.where((e) => (e as Map)['status'] == _filter).toList();

    return Column(
      children: [
        _FilterBar(value: _filter, onChanged: (v) => setState(() => _filter = v)),
        Expanded(
          child: shown.isEmpty
              ? EmptyNote(
                  icon: Icons.inbox_outlined,
                  title: _filter == 'pending'
                      ? 'Navbat bo‘sh — hammasi ko‘rib chiqilgan.'
                      : 'Bu bo‘limda yozuv yo‘q.',
                )
              : RefreshIndicator(
                  color: Eco.green,
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: shown.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = shown[index] as Map<String, dynamic>;
                      return _ReviewCard(
                        title: item['challenge_title'] as String? ?? 'Challenge',
                        who: item['full_name'] as String? ?? '',
                        className: item['class_name'] as String?,
                        date: item['submitted_at'],
                        points: (item['challenge_points'] as num?)?.toInt() ?? 0,
                        note: item['proof_text'] as String?,
                        photoKey: item['proof_url'] as String?,
                        status: item['status'] as String? ?? 'pending',
                        busy: _busy,
                        onApprove: () => _review(item, 'approved'),
                        onReject: () => _review(item, 'rejected'),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

/* ======================================================= recycling navbati */

class RecyclingReview extends StatefulWidget {
  const RecyclingReview({super.key, required this.onChanged});

  final VoidCallback onChanged;

  @override
  State<RecyclingReview> createState() => _RecyclingReviewState();
}

class _RecyclingReviewState extends State<RecyclingReview> {
  List<dynamic> _items = const [];
  String _filter = 'pending';
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await Api.instance.get('/recycling/admin/list');
      setState(() => _items = res['items'] as List? ?? const []);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _approve(Map<String, dynamic> item) async {
    final declared = (item['amount_kg'] as num?)?.toDouble() ?? 0;
    final controller = TextEditingController(text: declared.toString());

    final weight = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Eco.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Haqiqiy vazn',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Ball shu raqam bo‘yicha hisoblanadi.',
              style: TextStyle(fontSize: 13.5, color: Eco.muted),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(suffixText: 'kg'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Bekor', style: TextStyle(color: Eco.muted)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(
              ctx,
              double.tryParse(controller.text.replaceAll(',', '.')),
            ),
            child: const Text('Tasdiqlash'),
          ),
        ],
      ),
    );

    if (weight == null || weight <= 0) return;

    setState(() => _busy = true);
    try {
      final id = (item['id'] as num).toInt();
      final res = await Api.instance.post('/recycling/admin/$id/review', {
        'status': 'approved',
        'verifiedAmountKg': weight,
      });
      if (mounted) showNote(context, res['message'] as String? ?? 'Tasdiqlandi.');
      await _load();
      widget.onChanged();
    } on ApiException catch (e) {
      if (mounted) showNote(context, e.message, error: true);
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _reject(Map<String, dynamic> item) async {
    final yes = await confirm(
      context,
      title: 'Rad etilsinmi?',
      body: item['full_name'] as String?,
      yes: 'Rad etish',
      danger: true,
    );
    if (!yes) return;

    setState(() => _busy = true);
    try {
      final id = (item['id'] as num).toInt();
      final res = await Api.instance
          .post('/recycling/admin/$id/review', {'status': 'rejected'});
      if (mounted) showNote(context, res['message'] as String? ?? 'Rad etildi.');
      await _load();
      widget.onChanged();
    } on ApiException catch (e) {
      if (mounted) showNote(context, e.message, error: true);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Loading();
    if (_error != null) return ErrorNote(message: _error!, onRetry: _load);

    final shown = _items.where((e) => (e as Map)['status'] == _filter).toList();

    return Column(
      children: [
        _FilterBar(value: _filter, onChanged: (v) => setState(() => _filter = v)),
        Expanded(
          child: shown.isEmpty
              ? EmptyNote(
                  icon: Icons.scale_outlined,
                  title: _filter == 'pending'
                      ? 'Tarozi navbati bo‘sh.'
                      : 'Bu bo‘limda yozuv yo‘q.',
                )
              : RefreshIndicator(
                  color: Eco.green,
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: shown.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = shown[index] as Map<String, dynamic>;
                      final material = item['material'] as String? ?? '';

                      return _ReviewCard(
                        title:
                            '${materialNames[material] ?? material} · ${item['amount_kg']} kg',
                        who: item['full_name'] as String? ?? '',
                        className: item['class_name'] as String?,
                        date: item['submitted_at'],
                        points: (item['awarded_points'] as num?)?.toInt() ?? 0,
                        note: item['status'] == 'approved'
                            ? 'Tasdiqlangan vazn: ${item['verified_amount_kg']} kg'
                            : null,
                        photoKey: item['proof_image'] as String?,
                        status: item['status'] as String? ?? 'pending',
                        busy: _busy,
                        approveLabel: 'Tasdiqlash',
                        onApprove: () => _approve(item),
                        onReject: () => _reject(item),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

/* ============================================================ umumiy qism */

class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  static const _options = [
    ('pending', 'Kutilmoqda'),
    ('approved', 'Tasdiqlangan'),
    ('rejected', 'Rad etilgan'),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: const Color(0xFFE9EFE6),
          borderRadius: BorderRadius.circular(11),
        ),
        child: Row(
          children: _options.map((option) {
            final active = option.$1 == value;

            return Expanded(
              child: GestureDetector(
                onTap: () => onChanged(option.$1),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: active ? Eco.surface : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    option.$2,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: active ? Eco.ink : Eco.muted,
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({
    required this.title,
    required this.who,
    required this.className,
    required this.date,
    required this.points,
    required this.note,
    required this.photoKey,
    required this.status,
    required this.busy,
    required this.onApprove,
    required this.onReject,
    this.approveLabel,
  });

  final String title;
  final String who;
  final String? className;
  final Object? date;
  final int points;
  final String? note;
  final String? photoKey;
  final String status;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final String? approveLabel;

  @override
  Widget build(BuildContext context) {
    return EcoCard(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w700,
                        color: Eco.ink,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        ClassTag(name: className),
                        if (className != null) const SizedBox(width: 7),
                        Expanded(
                          child: Text(
                            '$who · ${shortDate(date)}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12.5, color: Eco.muted),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (points > 0 && status != 'pending')
                Text(
                  '+$points',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Eco.green,
                  ),
                ),
            ],
          ),

          if (note != null && note!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              note!,
              style: const TextStyle(fontSize: 13.5, height: 1.5, color: Eco.ink),
            ),
          ],

          if (photoKey != null && photoKey!.isNotEmpty) ...[
            const SizedBox(height: 12),
            GestureDetector(
              onTap: () => showDialog(
                context: context,
                builder: (_) => Dialog(
                  backgroundColor: Colors.black,
                  insetPadding: const EdgeInsets.all(12),
                  child: InteractiveViewer(
                    child: Image.network(
                      Api.instance.fileUrl(photoKey!, admin: true),
                      headers: Api.instance.imageHeaders,
                      errorBuilder: (_, __, ___) => const Padding(
                        padding: EdgeInsets.all(40),
                        child: Text(
                          'Rasm ochilmadi',
                          style: TextStyle(color: Colors.white),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  Api.instance.fileUrl(photoKey!, admin: true),
                  headers: Api.instance.imageHeaders,
                  height: 170,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
            ),
          ],

          if (status == 'pending') ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: busy ? null : onReject,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Eco.brick,
                      side: const BorderSide(color: Color(0xFFE6CFCA)),
                    ),
                    child: const Text('Rad etish'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: busy ? null : onApprove,
                    child: Text(
                      approveLabel ?? 'Tasdiqlash · +$points',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
            ),
          ] else ...[
            const SizedBox(height: 12),
            StatusChip(status: status),
          ],
        ],
      ),
    );
  }
}
