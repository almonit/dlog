import { Author } from "./author";

export class Session {
  private current_author: Author | null = null;
  private current_subdomain: string | null = null;

  setAuthor(author: Author): void {
    if (this.current_author) return;
    this.current_author = author;
  }

  getAuthor(): Author {
    if (!this.current_author) throw Error('session not found.');
    return this.current_author;
  }

  setSubdomain(subdomain): void {
    if (this.current_subdomain) return;
    this.current_subdomain = subdomain;
  }

  getSubdomain(): string {
    if (!this.current_subdomain) throw Error('session not found.');
    return this.current_subdomain;
  }

  clearSession() {
    this.current_author = null;
    this.current_subdomain = null;
  }
}
