import { describe, expect, it } from 'vitest';
import { emptyTuning, encodeBuild, newBuild, setTuning } from './build';
import { normalizeBuildCode, normalizeVideoUrl, validateSubmission, videoHostLabel } from './board';

const known = (id: string) => id === 'landspeeder';
const code = (() => {
  const b = newBuild('landspeeder');
  b.tuning = setTuning(emptyTuning(), 'ramjet', 3);
  return encodeBuild(b);
})();

describe('normalizeVideoUrl', () => {
  it('accepts the supported video sites and forces https', () => {
    expect(normalizeVideoUrl('https://www.youtube.com/watch?v=abc123')).toBe('https://youtube.com/watch?v=abc123');
    expect(normalizeVideoUrl('http://youtu.be/abc123')).toBe('https://youtube.com/watch?v=abc123');
    expect(normalizeVideoUrl('https://clips.twitch.tv/SomeClip')).toBe('https://clips.twitch.tv/SomeClip');
    expect(normalizeVideoUrl('streamable.com/xyz')).toBe('https://streamable.com/xyz');
  });

  it('drops tracking parameters and fragments but keeps the video id', () => {
    expect(normalizeVideoUrl('https://youtu.be/abcdef?si=TRACK&t=42#frag')).toBe('https://youtube.com/watch?t=42&v=abcdef');
    expect(normalizeVideoUrl('https://www.youtube.com/watch?v=abc&utm_source=x&feature=share')).toBe('https://youtube.com/watch?v=abc');
  });

  it('lists the same YouTube video once however the link was copied', () => {
    const forms = ['https://youtu.be/abcdef', 'youtu.be/abcdef?si=1', 'https://www.youtube.com/watch?v=abcdef', 'https://m.youtube.com/watch?v=abcdef&feature=share'];
    expect(new Set(forms.map(normalizeVideoUrl)).size).toBe(1);
  });

  it('rejects other hosts, look-alikes and other schemes', () => {
    for (const bad of [
      'https://example.com/video',
      'https://youtube.com.evil.example/watch?v=1',
      'https://evilyoutube.com/watch?v=1',
      'https://notyoutu.be/abc',
      'javascript:alert(1)',
      'data:text/html,hi',
      'ftp://youtube.com/watch?v=1',
      'https://user:pass@youtube.com/watch?v=1',
      'https://youtube.com:8443/watch?v=1',
      'not a url',
      '',
    ]) {
      expect(normalizeVideoUrl(bad), bad).toBeNull();
    }
  });

  it('rejects a site front page and overlong links', () => {
    expect(normalizeVideoUrl('https://youtube.com/')).toBeNull();
    expect(normalizeVideoUrl(`https://youtube.com/watch?v=${'a'.repeat(400)}`)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(normalizeVideoUrl(undefined)).toBeNull();
    expect(normalizeVideoUrl(42)).toBeNull();
  });
});

describe('normalizeBuildCode', () => {
  it('accepts a bare code and the links the site produces', () => {
    expect(normalizeBuildCode(code, known)).toBe(code);
    expect(normalizeBuildCode(`https://thisispodracing.pages.dev/b/${code}`, known)).toBe(code);
    expect(normalizeBuildCode(`thisispodracing.pages.dev/b/${code}/`, known)).toBe(code);
    expect(normalizeBuildCode(`https://thisispodracing.pages.dev/?b=${code}`, known)).toBe(code);
    expect(normalizeBuildCode(`  ${code}\n`, known)).toBe(code);
  });

  it('rejects junk, unknown classes and empty links', () => {
    expect(normalizeBuildCode('hello', known)).toBeNull();
    expect(normalizeBuildCode('https://thisispodracing.pages.dev/', known)).toBeNull();
    expect(normalizeBuildCode(code, () => false)).toBeNull();
    expect(normalizeBuildCode(null, known)).toBeNull();
  });
});

describe('validateSubmission', () => {
  it('returns the clean code and url', () => {
    expect(validateSubmission({ build: `/b/${code}`.slice(3), video: 'youtu.be/abcdef?si=1' }, known)).toEqual({
      ok: true,
      code,
      url: 'https://youtube.com/watch?v=abcdef',
    });
  });

  it('says which half is wrong', () => {
    expect(validateSubmission({ build: 'nope', video: 'youtu.be/abc' }, known)).toMatchObject({ ok: false, error: expect.stringContaining('build link') });
    expect(validateSubmission({ build: code, video: 'https://example.com/v' }, known)).toMatchObject({ ok: false, error: expect.stringContaining('video link') });
  });
});

describe('videoHostLabel', () => {
  it('shows a short site name', () => {
    expect(videoHostLabel('https://youtube.com/watch?v=1')).toBe('youtube.com');
    expect(videoHostLabel('https://youtu.be/1')).toBe('youtube.com');
    expect(videoHostLabel('https://clips.twitch.tv/x')).toBe('clips.twitch.tv');
  });
});
