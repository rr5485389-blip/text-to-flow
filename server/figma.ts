import { FigmaVerifyResponse, FigmaPostResponse } from '../src/types/workflow';

/**
 * Verifies Figma Personal Access Token and optionally checks file access
 */
export async function verifyFigmaToken(
  token: string,
  fileKey?: string
): Promise<FigmaVerifyResponse> {
  if (!token || token.trim() === '') {
    return { valid: false, error: 'Figma Personal Access Token is required.' };
  }

  try {
    const userRes = await fetch('https://api.figma.com/v1/me', {
      headers: {
        'X-Figma-Token': token.trim(),
      },
    });

    if (!userRes.ok) {
      if (userRes.status === 403 || userRes.status === 401) {
        return { valid: false, error: 'Invalid or expired Figma Personal Access Token.' };
      }
      return { valid: false, error: `Figma API returned status ${userRes.status}` };
    }

    const userData = await userRes.json();
    let fileName: string | undefined;

    // If fileKey is provided, check if the file exists and is accessible
    if (fileKey && fileKey.trim()) {
      const cleanKey = fileKey.trim().replace(/^https:\/\/www\.figma\.com\/(file|design|board)\/([^/?]+).*/, '$2');
      try {
        const fileRes = await fetch(`https://api.figma.com/v1/files/${cleanKey}`, {
          headers: {
            'X-Figma-Token': token.trim(),
          },
        });
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          fileName = fileData.name;
        }
      } catch (fErr) {
        console.warn('[Figma] Could not fetch file details:', fErr);
      }
    }

    return {
      valid: true,
      user: {
        id: userData.id,
        handle: userData.handle || 'Figma Designer',
        email: userData.email,
        img_url: userData.img_url,
      },
      fileName,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || 'Network error connecting to Figma API',
    };
  }
}

/**
 * Posts workflow analysis notes or comment to a specific Figma file
 */
export async function postCommentToFigmaFile(
  token: string,
  fileKey: string,
  message: string
): Promise<FigmaPostResponse> {
  if (!token || !fileKey) {
    return { success: false, error: 'Missing Figma token or file key.' };
  }

  const cleanKey = fileKey.trim().replace(/^https:\/\/www\.figma\.com\/(file|design|board)\/([^/?]+).*/, '$2');

  try {
    const res = await fetch(`https://api.figma.com/v1/files/${cleanKey}/comments`, {
      method: 'POST',
      headers: {
        'X-Figma-Token': token.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return {
        success: false,
        error: `Figma comment API error (${res.status}): ${errBody}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      commentId: data.id,
      message: 'Successfully posted workflow comment to your Figma canvas!',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to post comment to Figma file.',
    };
  }
}
