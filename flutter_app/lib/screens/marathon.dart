import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets.dart';

/// Marafon — ko'p kunlik challenge, kunlar panjarasi bilan.
class MarathonScreen extends StatefulWidget {
  const MarathonScreen({super.key});

  @override
  State<MarathonScreen> createState() => _MarathonScreenState();
}

class _MarathonScreenState extends State<MarathonScreen> {
  List<dynamic> _marathons = const [];
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
      final res = await Api.instance.get('/marathons');
      setState(() => _marathons = res['marathons'] as List? ?? const []);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _join(Map<String, dynamic> marathon) async {
    setState(() => _busy = true);
    try {
      final id = (marathon['id'] as num).toInt();
      final res = await Api.instance.post('/marathons/$id/join');
      if (mounted) showNote(context, res['message'] as String? ?? 'Qo‘shildingiz.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showNote(context, e.message, error: true);
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _check(Map<String, dynamic> marathon, int day) async {
    setState(() => _busy = true);
    try {
      final id = (marathon['id'] as num).toInt();
      final res = await Api.instance.post('/marathons/$id/checkin', {'day': day});

      final streak = (res['streak'] as num?)?.toInt() ?? 0;
      final message = res['message'] as String? ?? 'Belgilandi.';

      if (mounted) {
        showNote(context, streak > 1 ? '$message · Ketma-ket $streak kun 🔥' : message);
      }

      await _load();
      await session.refresh();
    } on ApiException catch (e) {
      if (mounted) showNote(context, e.message, error: true);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Eco.bg,
      appBar: AppBar(
        title: const Text('Marafon'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh, size: 22)),
        ],
      ),
      body: RefreshIndicator(
        color: Eco.green,
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Loading();
    if (_error != null) return ErrorNote(message: _error!, onRetry: _load);

    if (_marathons.isEmpty) {
      return const EmptyNote(
        icon: Icons.flag_outlined,
        title: 'Hozir faol marafon yo‘q',
        hint: 'Yangisi e’lon qilinganda shu yerda paydo bo‘ladi.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      itemCount: _marathons.length,
      separatorBuilder: (_, __) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        return _MarathonCard(
          marathon: _marathons[index] as Map<String, dynamic>,
          busy: _busy,
          onJoin: _join,
          onCheck: _check,
        );
      },
    );
  }
}

class _MarathonCard extends StatelessWidget {
  const _MarathonCard({
    required this.marathon,
    required this.busy,
    required this.onJoin,
    required this.onCheck,
  });

  final Map<String, dynamic> marathon;
  final bool busy;
  final void Function(Map<String, dynamic>) onJoin;
  final void Function(Map<String, dynamic>, int) onCheck;

  @override
  Widget build(BuildContext context) {
    final days = (marathon['days'] as num?)?.toInt() ?? 30;
    final today = (marathon['today'] as num?)?.toInt() ?? 0;
    final perDay = (marathon['points_per_day'] as num?)?.toInt() ?? 0;
    final bonus = (marathon['bonus_points'] as num?)?.toInt() ?? 0;
    final joined = marathon['joined'] == true;
    final finished = marathon['status'] != 'active';

    final done = <int>{
      for (final d in (marathon['checkins'] as List? ?? const []))
        (d as num).toInt(),
    };

    final tasks = <int, String>{
      for (final t in (marathon['dayTasks'] as List? ?? const []))
        ((t as Map<String, dynamic>)['day_number'] as num).toInt():
            t['title'] as String? ?? '',
    };

    final notStarted = today < 1;
    final over = today > days;
    final todayDone = done.contains(today);
    final yesterday = today - 1;
    final canFixYesterday =
        joined && !finished && !over && yesterday >= 1 && !done.contains(yesterday);

    return EcoCard(
      padding: const EdgeInsets.all(18),
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
                      marathon['title'] as String? ?? '',
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        color: Eco.ink,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '$days kun · kuniga +$perDay ball'
                      '${bonus > 0 ? ' · hammasi uchun +$bonus' : ''}',
                      style: const TextStyle(fontSize: 12.5, color: Eco.muted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              if (finished)
                const StatusChip(status: 'rejected')
              else if (joined)
                Column(
                  children: [
                    Text(
                      '${done.length}/$days',
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        color: Eco.green,
                      ),
                    ),
                    const Text('bajarildi', style: TextStyle(fontSize: 11, color: Eco.faint)),
                  ],
                ),
            ],
          ),

          if ((marathon['description'] as String? ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              marathon['description'] as String,
              style: const TextStyle(fontSize: 14, height: 1.55, color: Eco.muted),
            ),
          ],

          if (joined) ...[
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: days == 0 ? 0 : done.length / days,
                minHeight: 6,
                backgroundColor: const Color(0xFFEEF2EA),
                valueColor: const AlwaysStoppedAnimation(Eco.green),
              ),
            ),
          ],

          if (!joined && !finished) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: busy ? null : () => onJoin(marathon),
                child: const Text('Qo‘shilaman'),
              ),
            ),
          ],

          if (joined && notStarted) ...[
            const SizedBox(height: 14),
            _Panel(
              child: Text(
                'Marafon ${marathon['start_date']} kuni boshlanadi.',
                style: const TextStyle(fontSize: 14, color: Eco.muted),
              ),
            ),
          ],

          if (joined && !finished && !notStarted && !over) ...[
            const SizedBox(height: 14),
            _Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'BUGUN · $today-KUN',
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                      color: Eco.muted,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    tasks[today] ??
                        (marathon['description'] as String? ?? 'Bugungi eko-qadamni bajaring.'),
                    style: const TextStyle(fontSize: 15, height: 1.5, color: Eco.ink),
                  ),
                  const SizedBox(height: 14),
                  if (todayDone)
                    const Row(
                      children: [
                        Icon(Icons.check_circle, size: 19, color: Eco.green),
                        SizedBox(width: 7),
                        Text(
                          'Bugungi kun belgilangan',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Eco.green,
                          ),
                        ),
                      ],
                    )
                  else
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: busy ? null : () => onCheck(marathon, today),
                        child: Text('Bajardim · +$perDay ball'),
                      ),
                    ),
                  if (canFixYesterday)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: busy ? null : () => onCheck(marathon, yesterday),
                        child: Text('Kechagi $yesterday-kunni ham belgilash'),
                      ),
                    ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 16),
          _DayGrid(days: days, today: today, done: done, tasks: tasks),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFF3F6F1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: child,
      );
}

/// Kunlar panjarasi — bir qarashda qaysi kun bajarilgani ko'rinadi.
class _DayGrid extends StatelessWidget {
  const _DayGrid({
    required this.days,
    required this.today,
    required this.done,
    required this.tasks,
  });

  final int days;
  final int today;
  final Set<int> done;
  final Map<int, String> tasks;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: List.generate(days, (i) {
            final day = i + 1;
            final isDone = done.contains(day);
            final isToday = day == today;
            final future = day > today;

            return Tooltip(
              message: tasks[day] ?? '$day-kun',
              child: Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isDone
                      ? Eco.green
                      : isToday
                          ? Eco.surface
                          : future
                              ? const Color(0xFFF3F5EF)
                              : const Color(0xFFF9EFED),
                  borderRadius: BorderRadius.circular(9),
                  border: isToday ? Border.all(color: Eco.green, width: 2) : null,
                ),
                child: Text(
                  '$day',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isDone
                        ? Colors.white
                        : isToday
                            ? Eco.green
                            : future
                                ? const Color(0xFFC2CBBE)
                                : const Color(0xFFB08B84),
                  ),
                ),
              ),
            );
          }),
        ),
      ],
    );
  }
}
