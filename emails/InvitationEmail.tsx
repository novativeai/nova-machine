import * as React from 'react';

interface InvitationEmailProps {
  inviterName: string;
  boardName: string;
  inviteUrl: string;
  expiresAt: string;
}

export function InvitationEmail({
  inviterName,
  boardName,
  inviteUrl,
  expiresAt,
}: InvitationEmailProps) {
  return (
    <html>
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      </head>
      <body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f4f4', margin: 0, padding: 0 }}>
        <table
          width="100%"
          cellPadding="0"
          cellSpacing="0"
          style={{ backgroundColor: '#f4f4f4', padding: '40px 0' }}
        >
          <tr>
            <td align="center">
              <table
                width="600"
                cellPadding="0"
                cellSpacing="0"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                {/* Header */}
                <tr>
                  <td
                    style={{
                      padding: '40px 40px 30px',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <h1
                      style={{
                        margin: 0,
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#111827',
                      }}
                    >
                      NovaMachine
                    </h1>
                  </td>
                </tr>

                {/* Content */}
                <tr>
                  <td style={{ padding: '40px' }}>
                    <h2
                      style={{
                        margin: '0 0 20px',
                        fontSize: '20px',
                        fontWeight: '600',
                        color: '#111827',
                      }}
                    >
                      You've been invited to collaborate!
                    </h2>

                    <p
                      style={{
                        margin: '0 0 20px',
                        fontSize: '16px',
                        lineHeight: '24px',
                        color: '#374151',
                      }}
                    >
                      <strong>{inviterName}</strong> has invited you to collaborate on{' '}
                      <strong>{boardName}</strong>.
                    </p>

                    <p
                      style={{
                        margin: '0 0 30px',
                        fontSize: '16px',
                        lineHeight: '24px',
                        color: '#374151',
                      }}
                    >
                      Click the button below to accept this invitation and start collaborating:
                    </p>

                    {/* CTA Button */}
                    <table width="100%" cellPadding="0" cellSpacing="0">
                      <tr>
                        <td align="center" style={{ paddingBottom: '30px' }}>
                          <a
                            href={inviteUrl}
                            style={{
                              display: 'inline-block',
                              padding: '14px 32px',
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              textDecoration: 'none',
                              borderRadius: '6px',
                              fontSize: '16px',
                              fontWeight: '600',
                            }}
                          >
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>

                    {/* Alternative Link */}
                    <p
                      style={{
                        margin: '0 0 10px',
                        fontSize: '14px',
                        lineHeight: '20px',
                        color: '#6b7280',
                      }}
                    >
                      Or copy and paste this link into your browser:
                    </p>
                    <p
                      style={{
                        margin: '0 0 20px',
                        fontSize: '14px',
                        lineHeight: '20px',
                        color: '#2563eb',
                        wordBreak: 'break-all',
                      }}
                    >
                      {inviteUrl}
                    </p>

                    {/* Expiration Notice */}
                    <div
                      style={{
                        marginTop: '30px',
                        padding: '16px',
                        backgroundColor: '#fef3c7',
                        borderLeft: '4px solid #f59e0b',
                        borderRadius: '4px',
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: '14px',
                          lineHeight: '20px',
                          color: '#92400e',
                        }}
                      >
                        <strong>Note:</strong> This invitation expires on {expiresAt}.
                      </p>
                    </div>
                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td
                    style={{
                      padding: '30px 40px',
                      borderTop: '1px solid #e5e7eb',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    <p
                      style={{
                        margin: '0 0 10px',
                        fontSize: '14px',
                        lineHeight: '20px',
                        color: '#6b7280',
                      }}
                    >
                      This invitation was sent by {inviterName} via NovaMachine.
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        lineHeight: '18px',
                        color: '#9ca3af',
                      }}
                    >
                      If you didn't expect this invitation, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
};

export default InvitationEmail;
