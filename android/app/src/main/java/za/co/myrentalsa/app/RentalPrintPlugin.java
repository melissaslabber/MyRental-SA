package za.co.myrentalsa.app;

import android.content.Context;
import android.print.PrintManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RentalPrint")
public class RentalPrintPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager manager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                if (manager == null) { call.reject("Android printing is unavailable"); return; }
                manager.print("MyRental SA report", getBridge().getWebView().createPrintDocumentAdapter("MyRental SA report"), null);
                call.resolve();
            } catch (Exception exception) { call.reject("Could not open Android printing"); }
        });
    }
}
