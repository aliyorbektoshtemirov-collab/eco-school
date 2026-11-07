import 'package:flutter/material.dart';

import 'theme.dart';

/// Yuklanayotgan payt — markazdagi aylana.
class Loading extends StatelessWidget {
  const Loading({super.key});

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(40),
          child: CircularProgressIndicator(color: Eco.green, strokeWidth: 2.5),
        ),
      );
}

/// Bo'sh ro'yxat uchun.
class EmptyNote extends StatelessWidget {
  const EmptyNote({super.key, required this.title, this.hint, this.icon});

  final String title;
  final String? hint;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 40, color: Eco.faint),
              const SizedBox(height: 14),
            ],
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Eco.ink,
              ),
            ),
            if (hint != null) ...[
              const SizedBox(height: 8),
              Text(
                hint!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13.5, height: 1.5, color: Eco.muted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Xato matni — qayta urinish tugmasi bilan.
class ErrorNote extends StatelessWidget {
  const ErrorNote({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, height: 1.5, color: Eco.brick),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onRetry, child: const Text('Qayta urinish')),
            ],
          ],
        ),
      ),
    );
  }
}

/// Holat belgisi: kutilmoqda / tasdiqlangan / rad etilgan.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    late final Color bg;
    late final Color fg;
    late final String label;

    switch (status) {
      case 'approved':
      case 'published':
        bg = Eco.greenTint;
        fg = Eco.green;
        label = status == 'published' ? 'Nashr qilindi' : 'Tasdiqlangan';
        break;
      case 'rejected':
        bg = Eco.brickTint;
        fg = Eco.brick;
        label = 'Rad etilgan';
        break;
      default:
        bg = Eco.amberTint;
        fg = Eco.amber;
        label = 'Kutilmoqda';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(7)),
      child: Text(
        label,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }
}

/// Sinf belgisi — ism yonidagi kichik blok.
class ClassTag extends StatelessWidget {
  const ClassTag({super.key, required this.name});

  final String? name;

  @override
  Widget build(BuildContext context) {
    if (name == null || name!.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFEEF2EA),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        name!,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Color(0xFF4A5C4E),
        ),
      ),
    );
  }
}

/// Sanani qisqa ko'rinishda: «4-noy, 16:04».
String shortDate(Object? value) {
  if (value == null) return '';
  var text = value.toString();
  if (text.isEmpty) return '';

  text = text.replaceFirst(' ', 'T');
  if (!text.endsWith('Z') && !text.contains('+')) text = '${text}Z';

  final parsed = DateTime.tryParse(text);
  if (parsed == null) return '';

  const months = [
    'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
    'iyl', 'avg', 'sen', 'okt', 'noy', 'dek',
  ];

  final local = parsed.toLocal();
  final hh = local.hour.toString().padLeft(2, '0');
  final mm = local.minute.toString().padLeft(2, '0');

  return '${local.day}-${months[local.month - 1]}, $hh:$mm';
}

/// Xabarni pastdan chiqarish.
void showNote(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Eco.brick : Eco.ink,
        duration: const Duration(seconds: 3),
      ),
    );
}

/// Ikki bosqichli tasdiq — saytdagidek, tasodifan bosilmasin.
Future<bool> confirm(
  BuildContext context, {
  required String title,
  String? body,
  String yes = 'Ha',
  bool danger = false,
}) async {
  final answer = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: Eco.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
      content: body == null
          ? null
          : Text(body, style: const TextStyle(fontSize: 14, height: 1.5, color: Eco.muted)),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Yo‘q', style: TextStyle(color: Eco.muted)),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: ElevatedButton.styleFrom(
            backgroundColor: danger ? Eco.brick : Eco.green,
          ),
          child: Text(yes),
        ),
      ],
    ),
  );

  return answer ?? false;
}
