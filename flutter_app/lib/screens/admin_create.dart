import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

/// Vazifalar: qo'shish va tahrirlash.
class TaskAdmin extends StatefulWidget {
  const TaskAdmin({super.key});

  @override
  State<TaskAdmin> createState() => _TaskAdminState();
}

class _TaskAdminState extends State<TaskAdmin> {
  List<dynamic> _items = const [];
  bool _loading = true;
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
      final res = await Api.instance.get('/challenges/admin/challenges');
      setState(() => _items = res['challenges'] as List? ?? const []);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _open([Map<String, dynamic>? existing]) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TaskSheet(existing: existing),
    );

    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Loading();
    if (_error != null) return ErrorNote(message: _error!, onRetry: _load);

    return Scaffold(
      backgroundColor: Eco.bg,
      body: _items.isEmpty
          ? const EmptyNote(
              icon: Icons.task_alt_outlined,
              title: 'Hali vazifa yo‘q',
              hint: 'Pastdagi tugma bilan birinchisini qo‘shing.',
            )
          : RefreshIndicator(
              color: Eco.green,
              onRefresh: _load,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final item = _items[index] as Map<String, dynamic>;
                  final count = (item['submissions'] as num?)?.toInt() ?? 0;

                  return EcoCard(
                    padding: const EdgeInsets.all(15),
                    onTap: () => _open(item),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['title'] as String? ?? '',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Eco.ink,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${item['category']}'
                                '${count > 0 ? ' · $count ta topshiriq' : ''}',
                                style: const TextStyle(fontSize: 13, color: Eco.muted),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          '+${item['points']}',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Eco.green,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.chevron_right, color: Eco.faint),
                      ],
                    ),
                  );
                },
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Eco.green,
        foregroundColor: Colors.white,
        onPressed: () => _open(),
        icon: const Icon(Icons.add),
        label: const Text('Yangi vazifa'),
      ),
    );
  }
}

class _TaskSheet extends StatefulWidget {
  const _TaskSheet({this.existing});

  final Map<String, dynamic>? existing;

  @override
  State<_TaskSheet> createState() => _TaskSheetState();
}

class _TaskSheetState extends State<_TaskSheet> {
  late final _title = TextEditingController(text: widget.existing?['title'] as String? ?? '');
  late final _description =
      TextEditingController(text: widget.existing?['description'] as String? ?? '');
  late final _category =
      TextEditingController(text: widget.existing?['category'] as String? ?? 'UMUMIY');
  late final _points = TextEditingController(
    text: '${(widget.existing?['points'] as num?)?.toInt() ?? 30}',
  );

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _category.dispose();
    _points.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    final body = {
      'title': _title.text,
      'description': _description.text,
      'category': _category.text,
      'points': int.tryParse(_points.text) ?? 30,
    };

    try {
      final existing = widget.existing;
      final res = existing == null
          ? await Api.instance.post('/challenges/admin/challenges', body)
          : await Api.instance
              .put('/challenges/admin/challenges/${(existing['id'] as num).toInt()}', body);

      if (mounted) {
        Navigator.pop(context, true);
        showNote(context, res['message'] as String? ?? 'Saqlandi.');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorText(e);
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SheetFrame(
      title: widget.existing == null ? 'Yangi vazifa' : 'Vazifani tahrirlash',
      hint: widget.existing == null
          ? 'Qo‘shilgach botga ulangan o‘quvchilarga xabar ketadi.'
          : null,
      error: _error,
      busy: _busy,
      actionLabel: widget.existing == null ? 'Qo‘shish va xabar berish' : 'Saqlash',
      onAction: _save,
      children: [
        TextField(
          controller: _title,
          decoration: const InputDecoration(
            labelText: 'Sarlavha',
            hintText: 'Plastiksiz bir hafta',
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _description,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Nima qilish kerak',
            hintText: 'Bir hafta davomida bir martalik plastikdan voz keching.',
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              flex: 2,
              child: TextField(
                controller: _category,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(labelText: 'Turkum'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _points,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Ball'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/* ================================================================ marafon */

class MarathonAdmin extends StatefulWidget {
  const MarathonAdmin({super.key});

  @override
  State<MarathonAdmin> createState() => _MarathonAdminState();
}

class _MarathonAdminState extends State<MarathonAdmin> {
  List<dynamic> _items = const [];
  bool _loading = true;
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
      final res = await Api.instance.get('/admin/marathons');
      setState(() => _items = res['marathons'] as List? ?? const []);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _create() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _MarathonSheet(),
    );

    if (saved == true) await _load();
  }

  Future<void> _finish(Map<String, dynamic> item) async {
    final yes = await confirm(
      context,
      title: 'Marafon yakunlansinmi?',
      body: item['title'] as String?,
      yes: 'Yakunlash',
      danger: true,
    );
    if (!yes) return;

    try {
      final id = (item['id'] as num).toInt();
      final res = await Api.instance.post('/admin/marathons/$id/finish');
      if (mounted) showNote(context, res['message'] as String? ?? 'Yakunlandi.');
      await _load();
    } catch (e) {
      if (mounted) showNote(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Loading();
    if (_error != null) return ErrorNote(message: _error!, onRetry: _load);

    return Scaffold(
      backgroundColor: Eco.bg,
      body: _items.isEmpty
          ? const EmptyNote(
              icon: Icons.flag_outlined,
              title: 'Hali marafon yo‘q',
              hint: 'Ko‘p kunlik challenge — har kuni bitta vazifa.',
            )
          : RefreshIndicator(
              color: Eco.green,
              onRefresh: _load,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final item = _items[index] as Map<String, dynamic>;
                  final days = (item['days'] as num?)?.toInt() ?? 0;
                  final today = (item['today'] as num?)?.toInt() ?? 0;
                  final active = item['status'] == 'active';

                  final state = !active
                      ? 'yakunlangan'
                      : today < 1
                          ? 'boshlanmagan'
                          : today > days
                              ? 'muddati tugadi'
                              : '$today/$days-kun';

                  return EcoCard(
                    padding: const EdgeInsets.all(15),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                item['title'] as String? ?? '',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: Eco.ink,
                                ),
                              ),
                            ),
                            Container(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                              decoration: BoxDecoration(
                                color: active ? Eco.greenTint : const Color(0xFFF1F3EF),
                                borderRadius: BorderRadius.circular(7),
                              ),
                              child: Text(
                                state,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: active ? Eco.green : Eco.muted,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '$days kun · +${item['points_per_day']}/kun · '
                          '${item['participants'] ?? 0} ishtirokchi',
                          style: const TextStyle(fontSize: 13, color: Eco.muted),
                        ),
                        if (active) ...[
                          const SizedBox(height: 10),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: TextButton(
                              onPressed: () => _finish(item),
                              style: TextButton.styleFrom(foregroundColor: Eco.brick),
                              child: const Text('Yakunlash'),
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Eco.green,
        foregroundColor: Colors.white,
        onPressed: _create,
        icon: const Icon(Icons.add),
        label: const Text('Yangi marafon'),
      ),
    );
  }
}

class _MarathonSheet extends StatefulWidget {
  const _MarathonSheet();

  @override
  State<_MarathonSheet> createState() => _MarathonSheetState();
}

class _MarathonSheetState extends State<_MarathonSheet> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _days = TextEditingController(text: '30');
  final _perDay = TextEditingController(text: '10');
  final _bonus = TextEditingController(text: '100');
  final _tasks = TextEditingController();

  DateTime _start = DateTime.now();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _days.dispose();
    _perDay.dispose();
    _bonus.dispose();
    _tasks.dispose();
    super.dispose();
  }

  String get _startText =>
      '${_start.year}-${_start.month.toString().padLeft(2, '0')}-'
      '${_start.day.toString().padLeft(2, '0')}';

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _start,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _start = picked);
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final res = await Api.instance.post('/admin/marathons', {
        'title': _title.text,
        'description': _description.text,
        'days': int.tryParse(_days.text) ?? 30,
        'pointsPerDay': int.tryParse(_perDay.text) ?? 10,
        'bonusPoints': int.tryParse(_bonus.text) ?? 0,
        'startDate': _startText,
        'dayTasks': _tasks.text,
      });

      if (mounted) {
        Navigator.pop(context, true);
        showNote(context, res['message'] as String? ?? 'E’lon qilindi.');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorText(e);
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final lines = _tasks.text.split('\n').where((l) => l.trim().isNotEmpty).length;

    return SheetFrame(
      title: 'Yangi marafon',
      hint: 'E’lon qilingach botga va kanalga xabar ketadi.',
      error: _error,
      busy: _busy,
      actionLabel: 'E’lon qilish',
      onAction: _save,
      children: [
        TextField(
          controller: _title,
          decoration: const InputDecoration(
            labelText: 'Sarlavha',
            hintText: '30 kunlik eko-marafon',
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _description,
          maxLines: 2,
          decoration: const InputDecoration(labelText: 'Tavsif'),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _days,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Kunlar'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _perDay,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Kunlik ball'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _bonus,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Bonus'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        InkWell(
          onTap: _pickDate,
          borderRadius: BorderRadius.circular(12),
          child: InputDecorator(
            decoration: const InputDecoration(labelText: 'Boshlanish sanasi'),
            child: Row(
              children: [
                Text(_startText, style: const TextStyle(fontSize: 15, color: Eco.ink)),
                const Spacer(),
                const Icon(Icons.calendar_today_outlined, size: 18, color: Eco.muted),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _tasks,
          maxLines: 6,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            labelText: 'Kunlik vazifalar',
            helperText: '$lines ta qator · har qatorda bitta kun',
            hintText: 'Bitta plastik paketdan voz keching\n'
                'Jo‘mrakni yopib tish yuving\n'
                'Keraksiz chiroqlarni o‘chiring',
          ),
        ),
      ],
    );
  }
}

/* ================================================================= e'lon */

class AnnouncementAdmin extends StatefulWidget {
  const AnnouncementAdmin({super.key, required this.isOwner});

  final bool isOwner;

  @override
  State<AnnouncementAdmin> createState() => _AnnouncementAdminState();
}

class _AnnouncementAdminState extends State<AnnouncementAdmin> {
  List<dynamic> _items = const [];
  bool _loading = true;
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
      final res = await Api.instance.get('/admin/announcements');
      setState(() => _items = res['announcements'] as List? ?? const []);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _create() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _AnnouncementSheet(),
    );

    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Loading();
    if (_error != null) return ErrorNote(message: _error!, onRetry: _load);

    return Scaffold(
      backgroundColor: Eco.bg,
      body: _items.isEmpty
          ? EmptyNote(
              icon: Icons.campaign_outlined,
              title: 'Hali e’lon yo‘q',
              hint: widget.isOwner
                  ? 'Tadbir yoki muhim xabar bo‘lsa shu yerdan e’lon qiling.'
                  : 'E’lonni owner yozadi.',
            )
          : RefreshIndicator(
              color: Eco.green,
              onRefresh: _load,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final item = _items[index] as Map<String, dynamic>;
                  final sent = (item['sent_count'] as num?)?.toInt() ?? 0;

                  return EcoCard(
                    padding: const EdgeInsets.all(15),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item['title'] as String? ?? '',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Eco.ink,
                          ),
                        ),
                        if ((item['body'] as String? ?? '').isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            item['body'] as String,
                            style: const TextStyle(
                              fontSize: 13.5,
                              height: 1.5,
                              color: Eco.muted,
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          '${shortDate(item['created_at'])}'
                          '${sent > 0 ? ' · botda $sent kishiga' : ''}',
                          style: const TextStyle(fontSize: 12, color: Eco.faint),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
      floatingActionButton: widget.isOwner
          ? FloatingActionButton.extended(
              backgroundColor: Eco.green,
              foregroundColor: Colors.white,
              onPressed: _create,
              icon: const Icon(Icons.add),
              label: const Text('Yangi e’lon'),
            )
          : null,
    );
  }
}

class _AnnouncementSheet extends StatefulWidget {
  const _AnnouncementSheet();

  @override
  State<_AnnouncementSheet> createState() => _AnnouncementSheetState();
}

class _AnnouncementSheetState extends State<_AnnouncementSheet> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _toBot = true;
  bool _pinned = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final res = await Api.instance.post('/admin/announcements', {
        'title': _title.text,
        'body': _body.text,
        'toBot': _toBot,
        'pinned': _pinned,
      });

      if (mounted) {
        Navigator.pop(context, true);
        showNote(context, res['message'] as String? ?? 'Yuborildi.');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorText(e);
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SheetFrame(
      title: 'Yangi e’lon',
      hint: 'Saytda banner bo‘lib turadi, botga va kanalga xabar ketadi.',
      error: _error,
      busy: _busy,
      actionLabel: 'Yuborish',
      onAction: _send,
      children: [
        TextField(
          controller: _title,
          decoration: const InputDecoration(
            labelText: 'Sarlavha',
            hintText: 'Shanba kuni hashar bor',
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _body,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Matn',
            hintText: 'Soat 9:00 da maktab hovlisida yig‘ilamiz.',
          ),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          value: _toBot,
          onChanged: (v) => setState(() => _toBot = v),
          activeColor: Eco.green,
          contentPadding: EdgeInsets.zero,
          title: const Text('Bot va kanalga yuborilsin', style: TextStyle(fontSize: 14.5)),
        ),
        SwitchListTile(
          value: _pinned,
          onChanged: (v) => setState(() => _pinned = v),
          activeColor: Eco.green,
          contentPadding: EdgeInsets.zero,
          title: const Text('Saytda banner bo‘lib tursin', style: TextStyle(fontSize: 14.5)),
        ),
      ],
    );
  }
}

/* ========================================================= umumiy oyna */

/// Pastdan chiqadigan forma — hamma qo'shish oynalari shu ramkada.
class SheetFrame extends StatelessWidget {
  const SheetFrame({
    super.key,
    required this.title,
    required this.children,
    required this.actionLabel,
    required this.onAction,
    required this.busy,
    this.hint,
    this.error,
  });

  final String title;
  final List<Widget> children;
  final String actionLabel;
  final VoidCallback onAction;
  final bool busy;
  final String? hint;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.9,
        ),
        decoration: const BoxDecoration(
          color: Eco.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Eco.rule,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Eco.ink,
                ),
              ),
              if (hint != null) ...[
                const SizedBox(height: 6),
                Text(
                  hint!,
                  style: const TextStyle(fontSize: 13.5, height: 1.5, color: Eco.muted),
                ),
              ],
              const SizedBox(height: 18),
              ...children,
              if (error != null) ...[
                const SizedBox(height: 14),
                Text(error!, style: const TextStyle(fontSize: 13.5, color: Eco.brick)),
              ],
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: busy ? null : onAction,
                child: Text(busy ? 'Saqlanmoqda...' : actionLabel),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
