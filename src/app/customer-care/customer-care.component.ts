import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoginService } from '../login.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as uuid from 'uuid';
import { marked } from 'marked';
import serverEnvConfig from "client.env.config";

interface Message {
  text: string;
  sender: 'user' | 'care';
  timestamp: Date;
}

@Component({
  selector: 'app-customer-care',
  templateUrl: './customer-care.component.html',
  styleUrls: ['./customer-care.component.css']
})
export class CustomerCareComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer: ElementRef;

  messages: Message[] = [];
  newMessage: string = '';
  isLoading: boolean = false;
  userId: string = '';
  sessionId: string = '';

  constructor(
    private http: HttpClient,
    public loginService: LoginService,
    private sanitizer: DomSanitizer
  ) {
    this.sessionId = uuid.v4();
  }

  ngOnInit(): void {
    // Get authenticated user
    if (this.loginService.isUserAuthenticated()) {
      this.userId = this.loginService.getAuthenticatedUser();
    }

    // Add welcome message
    this.resetChat();
  }

  resetChat(): void {
    // Add welcome message
    this.messages = [];
    const welcomeText = this.userId
      ? `Welcome ${this.userId}! How can we help you today?`
      : 'Welcome to Customer Care! How can we help you today?';

    this.messages.push({
      text: welcomeText,
      sender: 'care',
      timestamp: new Date()
    });
  }
  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  sendMessage(): void {
    if (!this.newMessage || this.newMessage.trim() === '') {
      return;
    }

    // Add user message to the list
    const userMessage: Message = {
      text: this.newMessage.trim(),
      sender: 'user',
      timestamp: new Date()
    };
    this.messages.push(userMessage);

    const messageText = this.newMessage;
    this.newMessage = '';
    this.isLoading = true;

    // Send message to server which will proxy to backend
    this.http.post<{ response: string }>(serverEnvConfig.ANGULAR_API_CUSTOMER_CARE, {
      message: messageText,
      sessionId: this.sessionId
    })
      .subscribe({
        next: (response) => {
          // Add customer care response
          this.messages.push({
            text: response.response,
            sender: 'care',
            timestamp: new Date()
          });
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error sending message:', error);
          this.messages.push({
            text: 'Sorry, there was an error processing your request. Please try again.',
            sender: 'care',
            timestamp: new Date()
          });
          this.isLoading = false;
        }
      });
  }

  endChat(): void {
    this.isLoading = true;

    // Send end chat request to server
    this.http.post<{ response: string }>(serverEnvConfig.ANGULAR_API_CUSTOMER_CARE_END, {
      sessionId: this.sessionId
    })
      .subscribe({
        next: () => {
          // Refresh the page
          this.resetChat();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error ending chat:', error);
          // Refresh the page even on error
          this.resetChat();
        }
      });
  }

  formatMessage(text: string): SafeHtml {
    // Convert markdown to HTML using marked
    const html = marked(text);
    // Sanitize the HTML to prevent XSS attacks
    return this.sanitizer.sanitize(1, html) || '';
  }
}
