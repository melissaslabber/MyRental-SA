package za.co.myrentalsa.app;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RentalPrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
