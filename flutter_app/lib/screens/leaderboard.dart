import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets.dart';

/// Reyting: o'quvchilar va sinflar, davr bo'yicha.
class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);

  String _period = 'week';
  List<dynamic> _students = const [];
  List<dynamic> _classes = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final students = await Api.instance.get('/stats/leaderboard?period=$_period');
      final classes = await Api.instance.get('/stats/class-leaderboard?period=$_period');

      setState(() {
        _students = students['students'] as List? ?? const [];
        _classes = classes['classes'] as List? ?? const [];
      });
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }

    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Eco.bg,
      appBar: AppBar(
        title: const Text('Reyting'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(96),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: _PeriodSwitch(
                  value: _period,
                  onChanged: (value) {
                    setState(() => _period = value);
                    _load();
                  },
                ),
              ),
              TabBar(
                controller: _tabs,
                labelColor: Eco.green,
                unselectedLabelColor: Eco.muted,
                indicatorColor: Eco.green,
                indicatorSize: TabBarIndicatorSize.tab,
                labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                tabs: const [Tab(text: 'O‘quvchilar'), Tab(text: 'Sinflar')],
              ),
            ],
          ),
        ),
      ),
      body: _loading
          ? const Loading()
          : _error != null
              ? ErrorNote(message: _error!, onRetry: _load)
              : TabBarView(
                  controller: _tabs,
                  children: [_studentList(), _classList()],
                ),
    );
  }

  Widget _studentList() {
    if (_students.isEmpty) {
      return const EmptyNote(
        icon: Icons.emoji_events_outlined,
        title: 'Bu davrda hali ball yo‘q',
        hint: 'Birinchi bo‘lib vazifa bajaring — reyting shu yerdan boshlanadi.',
      );
    }

    final me = session.user?.id;

    return RefreshIndicator(
      color: Eco.green,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        itemCount: _students.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final item = _students[index] as Map<String, dynamic>;
          final isMe = (item['student_id'] as num?)?.toInt() == me;

          return _RankTile(
            rank: index + 1,
            title: item['full_name'] as String? ?? '',
            subtitle: item['class_name'] as String?,
            points: (item['points'] as num?)?.toInt() ?? 0,
            highlight: isMe,
          );
        },
      ),
    );
  }

  Widget _classList() {
    if (_classes.isEmpty) {
      return const EmptyNote(
        icon: Icons.groups_outlined,
        title: 'Bu davrda hali ball yo‘q',
      );
    }

    final myClass = session.user?.className;

    return RefreshIndicator(
      color: Eco.green,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        itemCount: _classes.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final item = _classes[index] as Map<String, dynamic>;
          final name = item['class_name'] as String? ?? '';
          final kg = (item['recycling_kg'] as num?)?.toDouble() ?? 0;

          return _RankTile(
            rank: index + 1,
            title: name,
            subtitle: kg > 0 ? '${kg.toStringAsFixed(1)} kg topshirilgan' : null,
            points: (item['total_points'] as num?)?.toInt() ?? 0,
            highlight: name == myClass,
          );
        },
      ),
    );
  }
}

class _PeriodSwitch extends StatelessWidget {
  const _PeriodSwitch({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  static const _options = [
    ('week', 'Shu hafta'),
    ('month', 'Shu oy'),
    ('all', 'Umumiy'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFE9EFE6),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: _options.map((option) {
          final active = option.$1 == value;

          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(option.$1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: active ? Eco.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(
                  option.$2,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: active ? Eco.ink : Eco.muted,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _RankTile extends StatelessWidget {
  const _RankTile({
    required this.rank,
    required this.title,
    required this.subtitle,
    required this.points,
    required this.highlight,
  });

  final int rank;
  final String title;
  final String? subtitle;
  final int points;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final medal = switch (rank) {
      1 => '🥇',
      2 => '🥈',
      3 => '🥉',
      _ => null,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(
        color: highlight ? Eco.greenTint : Eco.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: highlight ? Eco.green : Eco.rule),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 32,
            child: medal != null
                ? Text(medal, style: const TextStyle(fontSize: 20))
                : Text(
                    '$rank',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Eco.faint,
                    ),
                  ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Eco.ink,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: const TextStyle(fontSize: 12.5, color: Eco.muted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '$points',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Eco.green,
            ),
          ),
        ],
      ),
    );
  }
}
