import {
  Controller,
  Post,
  Req,
  Res,
  HttpStatus,
  UseInterceptors,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { OffersService } from "./offers.service";

@Controller("webhooks")
export class OffersWebhookController {
  constructor(private readonly offersService: OffersService) {}

  /**
   * Dropbox Sign webhook endpoint
   * Receives signature events and processes them
   * POST /webhooks/hellosign
   *
   * IMPORTANT: Dropbox Sign sends webhooks as multipart/form-data
   * with the event data in a 'json' field (as a stringified JSON object)
   *
   * Example (like Python's request.POST.get('json')):
   * - request.body.json = '{"event":{"event_type":"signature_request_signed"},...}'
   * - We parse this string to get the actual event data
   */
  @Post("hellosign")
  @UseInterceptors(AnyFilesInterceptor()) // Parse multipart/form-data (like multer)
  async handleHelloSignWebhook(@Req() req: Request, @Res() res: Response) {
    console.log("📝 Received Dropbox Sign webhook");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("req.body type:", typeof req.body);
    console.log("req.body:", req.body);
    console.log("req.body keys:", req.body ? Object.keys(req.body) : "N/A");

    try {
      // Dropbox Sign sends form-encoded data with a 'json' field (like Python's request.POST.get('json'))
      const jsonField = req.body?.json;

      if (!jsonField) {
        console.error("❌ No 'json' field in request body");
        console.log("Available fields:", req.body);
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: "Missing 'json' field in webhook payload",
        });
      }

      // Parse the JSON string (like Python's json.loads())
      let payload: any;
      try {
        payload =
          typeof jsonField === "string" ? JSON.parse(jsonField) : jsonField;
        console.log("✅ Successfully parsed json field");
      } catch (parseError) {
        console.error("❌ Failed to parse JSON:", parseError);
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: "Invalid JSON in 'json' field",
        });
      }

      console.log("Parsed payload:", JSON.stringify(payload, null, 2));

      // Process the webhook
      await this.offersService.handleWebhook(payload);

      // Return success response (Dropbox Sign expects "Hello API Event Received")
      return res.status(HttpStatus.OK).send("Hello API Event Received");
    } catch (error) {
      console.error("❌ Error processing webhook:", error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
}
