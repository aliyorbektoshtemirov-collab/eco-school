import 'package:flutter/material.dart';

import 'screens/login.dart';
import 'screens/shell.dart';
import 'session.dart';
import 'theme.dart';
import 'widgets.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const EcoApp());
}

final session = Session();

class EcoApp extends StatefulWidget {
  const EcoApp({super.key});

  @override
  State<EcoApp> createState() => _EcoAppState();
}

class _EcoAppState extends State<EcoApp> {
  @override
  void initState() {
    super.initState();
    session.restore();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ECO SCHOOL',
      debugShowCheckedModeBanner: false,
      theme: ecoTheme(),
      home: AnimatedBuilder(
        animation: session,
        builder: (context, _) {
          if (session.loading) {
            return const Scaffold(backgroundColor: Eco.bg, body: _Splash());
          }
          return session.signedIn ? const Shell() : const LoginScreen();
        },
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset('assets/timo.png', width: 120, height: 120),
          const SizedBox(height: 20),
          const Text(
            'ECO SCHOOL',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
              color: Eco.green,
            ),
          ),
          const SizedBox(height: 28),
          const Loading(),
        ],
      ),
    );
  }
}
