namespace CashewBlog.Domain.Rules;

/// <summary>
/// Word count suited for mixed Chinese/English text: every CJK ideograph, kana or hangul
/// syllable counts as one word; every run of other letters/digits counts as one word.
/// </summary>
public static class WordCounter
{
    public static int Count(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return 0;
        }

        var count = 0;
        var inWord = false;
        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (char.IsHighSurrogate(ch) && i + 1 < text.Length && char.IsLowSurrogate(text[i + 1]))
            {
                var cp = char.ConvertToUtf32(ch, text[i + 1]);
                i++;
                if (IsCjk(cp))
                {
                    count++;
                    inWord = false;
                }
                else if (char.IsLetterOrDigit(text, i - 1))
                {
                    if (!inWord) { count++; inWord = true; }
                }
                else
                {
                    inWord = false;
                }

                continue;
            }

            if (IsCjk(ch))
            {
                count++;
                inWord = false;
            }
            else if (char.IsLetterOrDigit(ch) || (inWord && ch is '\'' or '’'))
            {
                if (!inWord)
                {
                    count++;
                    inWord = true;
                }
            }
            else
            {
                inWord = false;
            }
        }

        return count;
    }

    public static bool IsCjk(int cp) =>
        cp is >= 0x4E00 and <= 0x9FFF // CJK Unified Ideographs
            or >= 0x3400 and <= 0x4DBF // Extension A
            or >= 0x20000 and <= 0x2EBEF // Extensions B-F
            or >= 0xF900 and <= 0xFAFF // Compatibility Ideographs
            or >= 0x3040 and <= 0x30FF // Hiragana + Katakana
            or >= 0xAC00 and <= 0xD7AF; // Hangul syllables
}
