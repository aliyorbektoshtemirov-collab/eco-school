import 'package:flutter/material.dart';

import '../theme.dart';
import 'challenges.dart';
import 'leaderboard.dart';
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

  @override
  Widget build(BuildContext context) {
    final screens = const [
      ChallengesScreen(),
      MarathonScreen(),
      RecyclingScreen(),
      LeaderboardScreen(),
      ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: Eco.bg,
      body: IndexedStack(index: _index, children: screens),
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
                NavigationDestination(
                  icon: Icon(Icons.task_alt_outlined, color: Eco.muted),
                  selectedIcon: Icon(Icons.task_alt, color: Eco.green),
                  label: 'Vazifalar',
                ),
                NavigationDestination(
                  icon: Icon(Icons.flag_outlined, color: Eco.muted),
                  selectedIcon: Icon(Icons.flag, color: Eco.green),
                  label: 'Marafon',
                ),
                NavigationDestination(
                  icon: Icon(Icons.recycling_outlined, color: Eco.muted),
                  selectedIcon: Icon(Icons.recycling, color: Eco.green),
                  label: 'Recycling',
                ),
                NavigationDestination(
                  icon: Icon(Icons.emoji_events_outlined, color: Eco.muted),
                  selectedIcon: Icon(Icons.emoji_events, color: Eco.green),
                  label: 'Reyting',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline, color: Eco.muted),
                  selectedIcon: Icon(Icons.person, color: Eco.green),
                  label: 'Profil',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
