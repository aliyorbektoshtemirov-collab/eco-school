import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';

import '../theme.dart';
import 'challenges.dart';
import 'site_page.dart';
import 'marathon.dart';
import 'profile.dart';
import 'recycling.dart';

/// Pastki navigatsiya — ilovaning asosiy ramkasi.
class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _index = 0;
  int _unread = 0;
  Timer? _notificationTimer;
  @override
  void initState() {
    super.initState();
    _loadUnread();
    _notificationTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadUnread());
  }
  Future<void> _loadUnread() async {
    try {
      final data = await Api.instance.get('/notifications');
      if (mounted) setState(() => _unread = (data['unread'] as num?)?.toInt() ?? 0);
    } catch (_) {}
  }
  @override
  void dispose() { _notificationTimer?.cancel(); super.dispose(); }


  @override
  Widget build(BuildContext context) {
    final screens = const [
      SitePage(path: '/', title: 'Home'),
      ChallengesScreen(),
      RecyclingScreen(),
      MarathonScreen(),
      ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: Eco.bg,
      body: IndexedStack(index: _index, children: screens),
      floatingActionButton: FloatingActionButton.small(
        heroTag: 'notifications',
        tooltip: 'Bildirishnomalar: $_unread ta yangi',
        onPressed: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => const SitePage(path: '/notifications', title: 'Bildirishnomalar')));
          _loadUnread();
        },
        child: Badge(isLabelVisible: _unread > 0, label: Text('$_unread'), child: const Icon(Icons.notifications_outlined)),
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Eco.surface,
          border: Border(top: BorderSide(color: Eco.rule)),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBarTheme(
            data: NavigationBarThemeData(
              backgroundColor: Eco.surface,
              indicatorColor: Eco.greenTint,
              labelTextStyle: WidgetStateProperty.resolveWith(
                (states) => TextStyle(
                  fontSize: 11.5,
                  fontWeight: states.contains(WidgetState.selected)
                      ? FontWeight.w600
                      : FontWeight.w400,
                  color: states.contains(WidgetState.selected) ? Eco.green : Eco.muted,
                ),
              ),
            ),
            child: NavigationBar(
              height: 64,
              elevation: 0,
              selectedIndex: _index,
              onDestinationSelected: (value) => setState(() => _index = value),
              destinations: const [
                NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home, color: Eco.green), label: 'Home'),
                NavigationDestination(icon: Icon(Icons.task_alt_outlined), selectedIcon: Icon(Icons.task_alt, color: Eco.green), label: 'Vazifalar'),
                NavigationDestination(icon: Icon(Icons.recycling_outlined), selectedIcon: Icon(Icons.recycling, color: Eco.green), label: 'Recycling'),
                NavigationDestination(icon: Icon(Icons.flag_outlined), selectedIcon: Icon(Icons.flag, color: Eco.green), label: 'Marafon'),
                NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person, color: Eco.green), label: 'Profil'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
