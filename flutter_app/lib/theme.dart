import 'package:flutter/material.dart';

/// Saytning ranglari — bola saytdan ilovaga o'tganda farqni sezmasin.
class Eco {
  static const bg = Color(0xFFF3F5EF);
  static const surface = Color(0xFFFFFFFF);
  static const green = Color(0xFF2F5D3A);
  static const greenDark = Color(0xFF285032);
  static const greenTint = Color(0xFFECF3EA);
  static const ink = Color(0xFF1F2B22);
  static const muted = Color(0xFF6B7A6F);
  static const faint = Color(0xFF9AA89D);
  static const rule = Color(0xFFE2E8DD);
  static const amber = Color(0xFF8A5F10);
  static const amberTint = Color(0xFFFDF6E6);
  static const brick = Color(0xFF8F4539);
  static const brickTint = Color(0xFFF9EFED);
}

ThemeData ecoTheme() {
  final base = ThemeData(useMaterial3: true, brightness: Brightness.light);

  return base.copyWith(
    scaffoldBackgroundColor: Eco.bg,
    colorScheme: base.colorScheme.copyWith(
      primary: Eco.green,
      onPrimary: Colors.white,
      surface: Eco.surface,
      onSurface: Eco.ink,
      error: Eco.brick,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Eco.surface,
      foregroundColor: Eco.ink,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: Eco.ink,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: Eco.green,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Eco.ink,
        side: const BorderSide(color: Eco.rule),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: Eco.green),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Eco.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Eco.rule),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Eco.rule),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Eco.green, width: 1.5),
      ),
      labelStyle: const TextStyle(color: Eco.muted),
      hintStyle: const TextStyle(color: Eco.faint),
    ),
    dividerTheme: const DividerThemeData(color: Eco.rule, thickness: 1, space: 1),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Eco.ink,
      contentTextStyle: TextStyle(color: Colors.white),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

/// Oq panel — saytdagi kartochkaning aynan o'zi.
class EcoCard extends StatelessWidget {
  const EcoCard({super.key, required this.child, this.padding, this.onTap});

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final body = Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Eco.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Eco.rule),
      ),
      child: child,
    );

    if (onTap == null) return body;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: body,
    );
  }
}
